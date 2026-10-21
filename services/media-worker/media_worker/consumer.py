"""RabbitMQ consumer for ``media.process``.

pika is used instead of aio-pika because the work is blocking anyway: ffmpeg runs as a
subprocess and psycopg is synchronous. A single blocking loop with prefetch 1 keeps the
worker simple and easy to reason about.

Processing is idempotent: the processed file replaces the original at the same object key and
the thumbnail is written to a fixed derived key, so a redelivered message only rewrites the
same objects and the same status.
"""

from __future__ import annotations

import hashlib
import json
import logging
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Protocol
from uuid import UUID

import pika

from media_worker.config import Settings
from media_worker.processing import (
    MediaProcessingError,
    ProcessedMedia,
    probe_media,
    process_media,
)
from media_worker.storage import ObjectNotFoundError, thumbnail_key

logger = logging.getLogger(__name__)

MESSAGE_FIELDS = ("media_object_id", "object_key", "mime_type")
ALLOWED_MIME_PREFIXES = ("image/", "audio/", "video/")
MIME_PREFIX_BY_KIND = {"photo": "image/", "audio": "audio/", "video": "video/"}
DELIVERY_COUNT_HEADER = "x-delivery-count"
RECONNECT_MAX_SECONDS = 30.0
HASH_CHUNK_SIZE = 1024 * 1024


class PermanentJobError(RuntimeError):
    """The message itself is unusable; requeueing it would only repeat the failure."""


class Storage(Protocol):
    def download(self, object_key: str, directory: Path) -> Path: ...

    def upload(self, path: Path, object_key: str, content_type: str) -> None: ...


class Repository(Protocol):
    def mark_processed(
        self,
        media_object_id: UUID,
        *,
        sha256: str,
        size_bytes: int,
        mime_type: str,
    ) -> None: ...

    def mark_failed(self, media_object_id: UUID) -> None: ...


ProcessFunction = Callable[[Path, Path], ProcessedMedia]


@dataclass(frozen=True)
class MediaJob:
    media_object_id: UUID
    object_key: str
    mime_type: str

    @classmethod
    def from_payload(cls, payload: bytes | str) -> MediaJob:
        if isinstance(payload, bytes):
            try:
                payload = payload.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise PermanentJobError("message is not UTF-8") from exc

        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise PermanentJobError("message is not valid JSON") from exc
        if not isinstance(data, dict):
            raise PermanentJobError("message must be a JSON object")

        missing = [field for field in MESSAGE_FIELDS if field not in data]
        if missing:
            raise PermanentJobError(f"message is missing {', '.join(missing)}")

        try:
            media_object_id = UUID(str(data["media_object_id"]))
        except (TypeError, ValueError) as exc:
            raise PermanentJobError("media_object_id must be a UUID") from exc

        object_key = data["object_key"]
        if not isinstance(object_key, str) or not _is_safe_object_key(object_key):
            raise PermanentJobError("object_key is not a safe object key")

        mime_type = data["mime_type"]
        if not isinstance(mime_type, str) or not mime_type.lower().startswith(
            ALLOWED_MIME_PREFIXES
        ):
            raise PermanentJobError("mime_type must be an image, audio or video type")

        return cls(
            media_object_id=media_object_id,
            object_key=object_key,
            mime_type=mime_type.lower(),
        )


def _is_safe_object_key(object_key: str) -> bool:
    if not object_key or object_key.startswith("/") or "\\" in object_key:
        return False
    if "\x00" in object_key:
        return False
    return all(segment not in {"", ".", ".."} for segment in object_key.split("/"))


class MediaJobProcessor:
    def __init__(
        self,
        storage: Storage,
        repository: Repository,
        *,
        timeout: int = 300,
        process: ProcessFunction | None = None,
    ) -> None:
        self._storage = storage
        self._repository = repository
        self._timeout = timeout
        self._process = partial(process_media, timeout=timeout) if process is None else process

    def handle(self, job: MediaJob) -> None:
        try:
            with tempfile.TemporaryDirectory(prefix="fieldnote-media-") as temporary_directory:
                workdir = Path(temporary_directory)
                source = self._storage.download(job.object_key, workdir)
                info = probe_media(source, timeout=self._timeout)
                expected_prefix = MIME_PREFIX_BY_KIND[info.kind]
                if not job.mime_type.startswith(expected_prefix):
                    raise MediaProcessingError(
                        f"declared type {job.mime_type!r} does not match detected {info.kind}"
                    )

                processed = self._process(source, workdir)
                sha256 = _file_sha256(processed.path)
                size_bytes = processed.path.stat().st_size
                self._storage.upload(processed.path, job.object_key, processed.mime_type)
                if processed.thumbnail_path is not None:
                    self._storage.upload(
                        processed.thumbnail_path,
                        thumbnail_key(job.object_key),
                        processed.thumbnail_mime_type or "image/jpeg",
                    )
        except (MediaProcessingError, ObjectNotFoundError):
            self.fail(job)
            raise

        self._repository.mark_processed(
            job.media_object_id,
            sha256=sha256,
            size_bytes=size_bytes,
            mime_type=processed.mime_type,
        )

    def fail(self, job: MediaJob) -> None:
        self._repository.mark_failed(job.media_object_id)


class MediaConsumer:
    def __init__(self, settings: Settings, processor: MediaJobProcessor) -> None:
        self._settings = settings
        self._processor = processor

    def run(self) -> None:
        delay = 1.0
        while True:
            try:
                self._consume()
            except KeyboardInterrupt:
                raise
            except (pika.exceptions.AMQPError, OSError) as exc:
                logger.warning(
                    "RabbitMQ unavailable (%s); reconnecting in %.1f seconds",
                    exc,
                    delay,
                )
                time.sleep(delay)
                delay = min(delay * 2, RECONNECT_MAX_SECONDS)
            else:
                delay = 1.0

    def _consume(self) -> None:
        parameters = pika.URLParameters(self._settings.rabbitmq_url)
        parameters.heartbeat = 60
        parameters.blocked_connection_timeout = 30
        connection = pika.BlockingConnection(parameters)
        try:
            channel = connection.channel()
            self._declare_queues(channel)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(
                queue=self._settings.media_queue,
                on_message_callback=self._on_message,
                auto_ack=False,
            )
            channel.start_consuming()
        finally:
            if connection.is_open:
                connection.close()

    def _declare_queues(self, channel: pika.channel.Channel) -> None:
        dead_letter_queue = self._settings.media_dead_letter_queue
        channel.queue_declare(
            queue=dead_letter_queue,
            durable=True,
            arguments={"x-queue-type": "quorum"},
        )
        channel.queue_declare(
            queue=self._settings.media_queue,
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-delivery-limit": self._settings.media_max_delivery_attempts,
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": dead_letter_queue,
            },
        )

    def _on_message(
        self,
        channel: pika.channel.Channel,
        method: pika.spec.Basic.Deliver,
        properties: pika.spec.BasicProperties,
        body: bytes,
    ) -> None:
        try:
            job = MediaJob.from_payload(body)
        except PermanentJobError as exc:
            logger.error("discarding invalid media message: %s", exc)
            channel.basic_reject(method.delivery_tag, requeue=False)
            return

        try:
            self._processor.handle(job)
        except (MediaProcessingError, ObjectNotFoundError) as exc:
            logger.error(
                "media object %s failed permanently: %s",
                job.media_object_id,
                exc,
            )
            channel.basic_reject(method.delivery_tag, requeue=False)
        except Exception as exc:
            attempt = _delivery_attempt(properties)
            if attempt >= self._settings.media_max_delivery_attempts:
                logger.error(
                    "media object %s failed after %d attempts: %s",
                    job.media_object_id,
                    attempt,
                    exc,
                )
                try:
                    self._processor.fail(job)
                except Exception:
                    logger.exception(
                        "could not mark media object %s as failed",
                        job.media_object_id,
                    )
                channel.basic_reject(method.delivery_tag, requeue=False)
            else:
                logger.warning(
                    "media object %s failed on attempt %d; retrying: %s",
                    job.media_object_id,
                    attempt,
                    exc,
                )
                channel.basic_nack(method.delivery_tag, requeue=True)
        else:
            logger.info("media object %s processed", job.media_object_id)
            channel.basic_ack(method.delivery_tag)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(HASH_CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def _delivery_attempt(properties: pika.spec.BasicProperties) -> int:
    headers = getattr(properties, "headers", None) or {}
    try:
        count = int(headers.get(DELIVERY_COUNT_HEADER, 0))
    except (TypeError, ValueError):
        count = 0
    return count + 1
