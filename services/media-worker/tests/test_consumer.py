from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from media_worker.config import Settings
from media_worker.consumer import (
    MediaConsumer,
    MediaJob,
    MediaJobProcessor,
    PermanentJobError,
)
from media_worker.processing import MediaProcessingError, ProcessedMedia
from media_worker.storage import ObjectNotFoundError, StorageError, thumbnail_key
from tests.conftest import Samples

MEDIA_OBJECT_ID = UUID("2f1c4a3e-7b1e-4b8f-9d2a-6c5e8f0a1b3c")
OBJECT_KEY = "uploads/photo.jpg"
PROCESSED_BYTES = b"processed"
PROCESSED_SHA256 = hashlib.sha256(PROCESSED_BYTES).hexdigest()


def payload(**overrides: Any) -> bytes:
    data = {
        "media_object_id": str(MEDIA_OBJECT_ID),
        "object_key": OBJECT_KEY,
        "mime_type": "image/jpeg",
    }
    data.update(overrides)
    return json.dumps(data).encode()


def fake_process(input_path: Path, workdir: Path) -> ProcessedMedia:
    output = Path(workdir) / "processed.jpg"
    output.write_bytes(PROCESSED_BYTES)
    thumbnail = Path(workdir) / "thumbnail.jpg"
    thumbnail.write_bytes(b"thumbnail")
    return ProcessedMedia(
        kind="photo",
        mime_type="image/jpeg",
        path=output,
        thumbnail_path=thumbnail,
        thumbnail_mime_type="image/jpeg",
    )


class FakeStorage:
    def __init__(
        self,
        source: Path,
        *,
        download_error: Exception | None = None,
        upload_error: Exception | None = None,
    ) -> None:
        self.source = source
        self.download_error = download_error
        self.upload_error = upload_error
        self.downloads: list[str] = []
        self.uploads: list[tuple[str, str]] = []

    def download(self, object_key: str, directory: Path) -> Path:
        self.downloads.append(object_key)
        if self.download_error is not None:
            raise self.download_error
        target = Path(directory) / "source"
        shutil.copyfile(self.source, target)
        return target

    def upload(self, path: Path, object_key: str, content_type: str) -> None:
        if self.upload_error is not None:
            raise self.upload_error
        self.uploads.append((object_key, content_type))


class FakeRepository:
    def __init__(self) -> None:
        self.processed: list[tuple[UUID, str, int, str]] = []
        self.failed: list[UUID] = []

    def mark_processed(
        self,
        media_object_id: UUID,
        *,
        sha256: str,
        size_bytes: int,
        mime_type: str,
    ) -> None:
        self.processed.append((media_object_id, sha256, size_bytes, mime_type))

    def mark_failed(self, media_object_id: UUID) -> None:
        self.failed.append(media_object_id)


def make_processor(
    storage: FakeStorage,
    repository: FakeRepository,
    process: Any = fake_process,
) -> MediaJobProcessor:
    return MediaJobProcessor(storage, repository, process=process)


def test_handle_uploads_outputs_and_marks_processed(samples: Samples) -> None:
    storage = FakeStorage(samples.photo)
    repository = FakeRepository()
    job = MediaJob.from_payload(payload())

    make_processor(storage, repository).handle(job)

    assert storage.downloads == [OBJECT_KEY]
    assert storage.uploads == [
        (OBJECT_KEY, "image/jpeg"),
        (thumbnail_key(OBJECT_KEY), "image/jpeg"),
    ]
    assert repository.processed == [
        (MEDIA_OBJECT_ID, PROCESSED_SHA256, len(PROCESSED_BYTES), "image/jpeg")
    ]
    assert repository.failed == []


def test_handle_records_the_processed_file_metadata(samples: Samples) -> None:
    storage = FakeStorage(samples.photo)
    repository = FakeRepository()
    job = MediaJob.from_payload(payload())
    processed_bytes = b"transcoded-video"

    def processing(input_path: Path, workdir: Path) -> ProcessedMedia:
        output = Path(workdir) / "processed.mp4"
        output.write_bytes(processed_bytes)
        return ProcessedMedia(kind="video", mime_type="video/mp4", path=output)

    make_processor(storage, repository, process=processing).handle(job)

    assert repository.processed == [
        (
            MEDIA_OBJECT_ID,
            hashlib.sha256(processed_bytes).hexdigest(),
            len(processed_bytes),
            "video/mp4",
        )
    ]


def test_processing_twice_is_idempotent(samples: Samples) -> None:
    storage = FakeStorage(samples.photo)
    repository = FakeRepository()
    processor = make_processor(storage, repository)
    job = MediaJob.from_payload(payload())

    processor.handle(job)
    processor.handle(job)

    assert storage.uploads == [
        (OBJECT_KEY, "image/jpeg"),
        (thumbnail_key(OBJECT_KEY), "image/jpeg"),
        (OBJECT_KEY, "image/jpeg"),
        (thumbnail_key(OBJECT_KEY), "image/jpeg"),
    ]
    expected = (MEDIA_OBJECT_ID, PROCESSED_SHA256, len(PROCESSED_BYTES), "image/jpeg")
    assert repository.processed == [expected, expected]
    assert repository.failed == []


def test_permanent_processing_error_marks_failed(samples: Samples) -> None:
    storage = FakeStorage(samples.photo)
    repository = FakeRepository()
    job = MediaJob.from_payload(payload())

    def failing_process(input_path: Path, workdir: Path) -> ProcessedMedia:
        raise MediaProcessingError("corrupt stream")

    with pytest.raises(MediaProcessingError):
        make_processor(storage, repository, process=failing_process).handle(job)

    assert repository.failed == [MEDIA_OBJECT_ID]
    assert repository.processed == []
    assert storage.uploads == []


def test_missing_object_marks_failed(samples: Samples) -> None:
    storage = FakeStorage(samples.photo, download_error=ObjectNotFoundError("missing"))
    repository = FakeRepository()
    job = MediaJob.from_payload(payload())

    with pytest.raises(ObjectNotFoundError):
        make_processor(storage, repository).handle(job)

    assert repository.failed == [MEDIA_OBJECT_ID]
    assert repository.processed == []


def test_transient_storage_error_leaves_the_status_alone(samples: Samples) -> None:
    storage = FakeStorage(samples.photo, download_error=StorageError("S3 is down"))
    repository = FakeRepository()
    job = MediaJob.from_payload(payload())

    with pytest.raises(StorageError):
        make_processor(storage, repository).handle(job)

    assert repository.failed == []
    assert repository.processed == []


def test_declared_and_detected_types_must_match(samples: Samples) -> None:
    storage = FakeStorage(samples.photo)
    repository = FakeRepository()
    job = MediaJob.from_payload(payload(mime_type="video/mp4"))

    def unreachable_process(input_path: Path, workdir: Path) -> ProcessedMedia:
        raise AssertionError("the processor must not run for a type mismatch")

    with pytest.raises(MediaProcessingError, match="does not match"):
        make_processor(storage, repository, process=unreachable_process).handle(job)

    assert repository.failed == [MEDIA_OBJECT_ID]
    assert storage.uploads == []


@pytest.mark.parametrize(
    "body",
    [
        b"not json",
        b"[]",
        json.dumps({"media_object_id": str(MEDIA_OBJECT_ID)}).encode(),
        payload(media_object_id="not-a-uuid"),
        payload(object_key="../escape.jpg"),
        payload(object_key="/absolute.jpg"),
        payload(object_key=""),
        payload(mime_type="text/html"),
        payload(mime_type="application/octet-stream"),
        payload(mime_type=123),
    ],
)
def test_invalid_messages_are_permanent(body: bytes) -> None:
    with pytest.raises(PermanentJobError):
        MediaJob.from_payload(body)


def test_valid_message_is_parsed() -> None:
    job = MediaJob.from_payload(payload(mime_type="IMAGE/JPEG"))

    assert job.media_object_id == MEDIA_OBJECT_ID
    assert job.object_key == OBJECT_KEY
    assert job.mime_type == "image/jpeg"


class FakeChannel:
    def __init__(self) -> None:
        self.events: list[tuple[Any, ...]] = []

    def basic_ack(self, delivery_tag: int) -> None:
        self.events.append(("ack", delivery_tag))

    def basic_reject(self, delivery_tag: int, requeue: bool) -> None:
        self.events.append(("reject", delivery_tag, requeue))

    def basic_nack(self, delivery_tag: int, requeue: bool) -> None:
        self.events.append(("nack", delivery_tag, requeue))


class StubProcessor:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.handled: list[MediaJob] = []
        self.failed: list[UUID] = []

    def handle(self, job: MediaJob) -> None:
        self.handled.append(job)
        if self.error is not None:
            raise self.error

    def fail(self, job: MediaJob) -> None:
        self.failed.append(job.media_object_id)


def consume(
    processor: StubProcessor,
    body: bytes,
    *,
    delivery_count: int | None = None,
) -> list[tuple[Any, ...]]:
    channel = FakeChannel()
    properties = SimpleNamespace(
        headers={} if delivery_count is None else {"x-delivery-count": delivery_count}
    )
    MediaConsumer(Settings(), processor)._on_message(
        channel,
        SimpleNamespace(delivery_tag=7),
        properties,
        body,
    )
    return channel.events


def test_message_is_acked_after_success() -> None:
    processor = StubProcessor()

    assert consume(processor, payload()) == [("ack", 7)]
    assert len(processor.handled) == 1


def test_permanent_error_is_rejected_without_requeue() -> None:
    processor = StubProcessor(MediaProcessingError("bad codec"))

    assert consume(processor, payload()) == [("reject", 7, False)]


def test_missing_object_is_rejected_without_requeue() -> None:
    processor = StubProcessor(ObjectNotFoundError("gone"))

    assert consume(processor, payload()) == [("reject", 7, False)]


def test_transient_error_is_requeued() -> None:
    processor = StubProcessor(StorageError("temporary"))

    assert consume(processor, payload()) == [("nack", 7, True)]
    assert processor.failed == []


def test_last_attempt_marks_failed_and_rejects() -> None:
    processor = StubProcessor(StorageError("temporary"))

    assert consume(processor, payload(), delivery_count=4) == [("reject", 7, False)]
    assert processor.failed == [MEDIA_OBJECT_ID]


def test_invalid_message_is_rejected_without_reaching_the_processor() -> None:
    processor = StubProcessor()

    assert consume(processor, b"not json") == [("reject", 7, False)]
    assert processor.handled == []
