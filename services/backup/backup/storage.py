"""Object storage access for media and backup archives."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from backup.config import Settings
from backup.errors import BackupError

logger = logging.getLogger(__name__)

ADMIN_TIMEOUT_SECONDS = 10
LIST_PAGE_SIZE = 1000


@dataclass(frozen=True)
class ObjectInfo:
    key: str
    size: int


def _client_config() -> Config:
    return Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"},
        retries={"max_attempts": 3, "mode": "standard"},
        connect_timeout=5,
        read_timeout=120,
    )


class ObjectStorage:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self._settings = settings
        self._client = client or boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=_client_config(),
        )

    def ensure_backups_bucket(self) -> None:
        self.ensure_bucket(self._settings.backups_bucket)

    def ensure_bucket(self, bucket: str) -> None:
        admin_endpoint = self._settings.garage_admin_endpoint
        admin_token = self._settings.garage_admin_token
        if admin_endpoint and admin_token:
            bucket_id = self._admin_find_or_create(bucket, admin_endpoint, admin_token)
            self._admin_allow_key(bucket_id, admin_endpoint, admin_token)
            return
        try:
            self._client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            if _error_code(exc) not in {"404", "NoSuchBucket", "NotFound"}:
                raise BackupError(f"cannot check bucket {bucket!r}: {exc}") from exc
            try:
                self._client.create_bucket(Bucket=bucket)
            except (BotoCoreError, ClientError) as create_exc:
                raise BackupError(
                    f"cannot create bucket {bucket!r}: {create_exc}; "
                    "set FIELDNOTE_GARAGE_ADMIN_ENDPOINT and FIELDNOTE_GARAGE_ADMIN_TOKEN"
                ) from create_exc

    def media_objects(self, skip_prefixes: Iterable[str]) -> Iterator[ObjectInfo]:
        prefixes = tuple(skip_prefixes)
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._settings.s3_bucket):
            for item in page.get("Contents", []):
                key = item["Key"]
                if prefixes and key.startswith(prefixes):
                    continue
                yield ObjectInfo(key=key, size=int(item["Size"]))

    def count_media(self, skip_prefixes: Iterable[str]) -> int:
        return sum(1 for _ in self.media_objects(skip_prefixes))

    @contextmanager
    def open_media(self, key: str) -> Iterator[tuple[BinaryIO, str]]:
        try:
            response = self._client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            raise BackupError(f"cannot read media object {key!r}: {exc}") from exc
        body = response["Body"]
        try:
            yield body, str(response.get("ContentType") or "application/octet-stream")
        finally:
            body.close()

    def upload_archive(self, path: Path, key: str) -> None:
        try:
            self._client.upload_file(str(path), self._settings.backups_bucket, key)
        except (BotoCoreError, ClientError) as exc:
            raise BackupError(f"cannot upload archive {key!r}: {exc}") from exc

    def download_archive(self, key: str, path: Path) -> None:
        try:
            self._client.download_file(self._settings.backups_bucket, key, str(path))
        except (BotoCoreError, ClientError) as exc:
            raise BackupError(f"cannot download archive {key!r}: {exc}") from exc

    def prune_archives(self, cutoff: datetime) -> int:
        deleted = 0
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._settings.backups_bucket):
            for item in page.get("Contents", []):
                modified = item.get("LastModified")
                if modified is not None and modified >= cutoff:
                    continue
                try:
                    self._client.delete_object(
                        Bucket=self._settings.backups_bucket, Key=item["Key"]
                    )
                except (BotoCoreError, ClientError) as exc:
                    raise BackupError(f"cannot prune archive {item['Key']!r}: {exc}") from exc
                deleted += 1
        return deleted

    def upload_restored(self, path: Path, key: str, content_type: str) -> None:
        try:
            self._client.upload_file(
                str(path),
                self._settings.s3_bucket,
                key,
                ExtraArgs={"ContentType": content_type},
            )
        except (BotoCoreError, ClientError) as exc:
            raise BackupError(f"cannot restore media object {key!r}: {exc}") from exc

    def _admin_find_or_create(self, bucket: str, endpoint: str, token: str) -> str:
        for item in self._admin_request("GET", endpoint, token, "/v2/ListBuckets"):
            if bucket in item.get("globalAliases", []):
                return str(item["id"])

        try:
            created = self._admin_request(
                "POST",
                endpoint,
                token,
                "/v2/CreateBucket",
                {"globalAlias": bucket},
            )
            return str(created["id"])
        except BackupError as exc:
            # A concurrent run may have created it between the list and the create.
            for item in self._admin_request("GET", endpoint, token, "/v2/ListBuckets"):
                if bucket in item.get("globalAliases", []):
                    return str(item["id"])
            raise exc

    def _admin_allow_key(self, bucket_id: str, endpoint: str, token: str) -> None:
        if not self._settings.s3_access_key:
            raise BackupError("FIELDNOTE_S3_ACCESS_KEY is required for the backups bucket")
        self._admin_request(
            "POST",
            endpoint,
            token,
            "/v2/AllowBucketKey",
            {
                "bucketId": bucket_id,
                "accessKeyId": self._settings.s3_access_key,
                "permissions": {"read": True, "write": True, "owner": True},
            },
        )

    def _admin_request(
        self,
        method: str,
        endpoint: str,
        token: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            endpoint.rstrip("/") + path,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=ADMIN_TIMEOUT_SECONDS) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise BackupError(f"Garage admin API {path} failed: {exc.code} {detail}") from exc
        except (OSError, ValueError) as exc:
            raise BackupError(f"Garage admin API {path} failed: {exc}") from exc


def _error_code(exc: ClientError) -> str:
    return str(exc.response.get("Error", {}).get("Code", ""))
