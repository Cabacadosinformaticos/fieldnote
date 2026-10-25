"""Object storage: signed upload URLs and existence checks.

The API talks to Garage on its internal endpoint to check that an object exists, but the URL
handed to the phone must point at the public gateway, `settings.media_public_endpoint`.
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
OBJECT_KEY_PREFIX = "entries"
_NOT_FOUND_CODES = frozenset({"404", "NoSuchKey", "NotFound"})


def public_endpoint() -> str:
    return settings.media_public_endpoint.rstrip("/")


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


def object_exists(object_key: str) -> bool:
    """Ask object storage whether the upload arrived, without downloading it."""
    try:
        _client(settings.s3_endpoint).head_object(Bucket=settings.s3_bucket, Key=object_key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in _NOT_FOUND_CODES:
            return False
        raise
    return True


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
