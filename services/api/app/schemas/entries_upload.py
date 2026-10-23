"""Request and response bodies for signed uploads and entry submission."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import AwareDatetime, BaseModel, Field

from app.models.enums import EntryType

SHA256_PATTERN = r"^[0-9a-fA-F]{64}$"


class MediaUploadRequest(BaseModel):
    entry_id: uuid.UUID
    mime_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(gt=0)
    sha256: str = Field(pattern=SHA256_PATTERN)


class MediaUploadResponse(BaseModel):
    media_object_id: uuid.UUID
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    expires_at: datetime


class EntrySubmitRequest(BaseModel):
    id: uuid.UUID
    activity_id: uuid.UUID
    prompt_id: uuid.UUID | None = None
    entry_type: EntryType
    content_sha256: str = Field(pattern=SHA256_PATTERN)
    recorded_at: AwareDatetime
    body: str | None = Field(default=None, max_length=100_000)
    value: int | None = None
    scale_shown: dict[str, Any] | None = None
    choice: str | None = Field(default=None, max_length=500)
    media_object_ids: list[uuid.UUID] = Field(default_factory=list)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class EntrySubmitResponse(BaseModel):
    id: uuid.UUID
    duplicate: bool
    received_at: datetime
