"""Small S3 wrapper for the objects the media worker reads and writes."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from s3transfer.exceptions import (
    RetriesExceededError,
    S3DownloadFailedError,
    S3UploadFailedError,
)

if TYPE_CHECKING:
    from media_worker.config import Settings

SOURCE_FILE_NAME = "source"
THUMBNAIL_SUFFIX = ".thumb.jpg"


class StorageError(RuntimeError):
    """A temporary failure talking to object storage; the job can be retried."""


class ObjectNotFoundError(StorageError):
    """The source object does not exist; retrying will not help."""


def thumbnail_key(object_key: str) -> str:
    return f"{object_key}{THUMBNAIL_SUFFIX}"


class ObjectStorage:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self._bucket = settings.s3_bucket
        self._client = client or boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=5,
                read_timeout=60,
            ),
        )

    def download(self, object_key: str, directory: Path) -> Path:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / SOURCE_FILE_NAME
        try:
            self._client.download_file(self._bucket, object_key, str(target))
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise ObjectNotFoundError(f"object {object_key!r} does not exist") from exc
            raise StorageError(f"could not download {object_key!r}: {code or exc}") from exc
        except (BotoCoreError, RetriesExceededError, S3DownloadFailedError) as exc:
            raise StorageError(f"could not download {object_key!r}: {exc}") from exc
        return target

    def upload(self, path: Path, object_key: str, content_type: str) -> None:
        try:
            self._client.upload_file(
                str(path),
                self._bucket,
                object_key,
                ExtraArgs={"ContentType": content_type},
            )
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            raise StorageError(f"could not upload {object_key!r}: {code or exc}") from exc
        except (BotoCoreError, RetriesExceededError, S3UploadFailedError) as exc:
            raise StorageError(f"could not upload {object_key!r}: {exc}") from exc
