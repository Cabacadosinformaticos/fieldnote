"""Object storage: signed upload and download URLs and existence checks.

The API talks to Garage on its internal endpoint to check that an object exists. URLs handed to a
client must point at the gateway that client can reach: `settings.media_public_endpoint` for phones
and `settings.media_dashboard_endpoint` for the researcher's browser.
"""

import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import boto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

UPLOAD_URL_TTL_SECONDS = 10 * 60
DOWNLOAD_URL_TTL_SECONDS = 10 * 60
DOWNLOAD_CHUNK_BYTES = 1024 * 1024
OBJECT_KEY_PREFIX = "entries"
# The media worker writes the JPEG preview next to the original (media_worker/storage.py).
THUMBNAIL_SUFFIX = ".thumb.jpg"
_NOT_FOUND_CODES = frozenset({"404", "NoSuchKey", "NotFound"})


def public_endpoint() -> str:
    return settings.media_public_endpoint.rstrip("/")


def dashboard_endpoint() -> str:
    return settings.media_dashboard_endpoint.rstrip("/")


def upload_object_key(
    participant_id: uuid.UUID, entry_id: uuid.UUID, media_object_id: uuid.UUID
) -> str:
    return f"{OBJECT_KEY_PREFIX}/{participant_id}/{entry_id}/{media_object_id}"


def upload_object_prefix(participant_id: uuid.UUID, entry_id: uuid.UUID) -> str:
    return f"{OBJECT_KEY_PREFIX}/{participant_id}/{entry_id}/"


@lru_cache(maxsize=4)
def _client(endpoint: str) -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def presign_put(object_key: str, mime_type: str, size_bytes: int) -> tuple[str, datetime]:
    """Return a PUT URL valid for ten minutes and the moment it expires.

    The content type and the exact length are signed into the URL, so object storage refuses a
    file that is larger than the size the app declared or of another type.
    """
    url = _client(public_endpoint()).generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
            "ContentType": mime_type,
            "ContentLength": size_bytes,
        },
        ExpiresIn=UPLOAD_URL_TTL_SECONDS,
    )
    return url, datetime.now(UTC) + timedelta(seconds=UPLOAD_URL_TTL_SECONDS)


def presign_get(object_key: str) -> tuple[str, datetime]:
    """Return a GET URL valid for ten minutes and the moment it stops working.

    Researchers open it in a browser, so it is signed on the dashboard gateway, path style, under
    ``/media/<key>`` exactly like an upload URL.
    """
    url = _client(dashboard_endpoint()).generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": object_key},
        ExpiresIn=DOWNLOAD_URL_TTL_SECONDS,
    )
    return url, datetime.now(UTC) + timedelta(seconds=DOWNLOAD_URL_TTL_SECONDS)


def object_exists(object_key: str) -> bool:
    """Ask object storage whether the upload arrived, without downloading it."""
    try:
        _client(settings.s3_endpoint).head_object(Bucket=settings.s3_bucket, Key=object_key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in _NOT_FOUND_CODES:
            return False
        raise
    return True


def open_object(object_key: str):
    """Open a stored object as a streaming body.

    The caller reads it in chunks and closes it. The export uses this to write a large media file
    into the zip without loading it into memory.
    """
    response = _client(settings.s3_endpoint).get_object(Bucket=settings.s3_bucket, Key=object_key)
    return response["Body"]


def delete_participant_objects(participant_id: uuid.UUID) -> int:
    """Delete every object stored for one participant and return how many were deleted.

    The participant id is the first segment of every key, so a prefix delete also removes an
    upload that never got a database row. Deleting a prefix that holds no object is not an error,
    which makes a retried erasure safe.
    """
    client = _client(settings.s3_endpoint)
    prefix = f"{OBJECT_KEY_PREFIX}/{participant_id}/"
    deleted = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
        if not objects:
            continue
        client.delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": objects, "Quiet": True},
        )
        deleted += len(objects)
    return deleted
