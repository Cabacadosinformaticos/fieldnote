"""Requests the research team passes to the administrator for an outside-the-app erasure."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.enums import StudyRole


class ErasureRequestCreate(BaseModel):
    received_at: datetime


class ErasureRequestSummaryOut(BaseModel):
    id: uuid.UUID
    status: Literal["pending", "done", "cancelled"]
    # Null once the participant is erased; the alias and the counts stay on the request.
    participant_id: uuid.UUID | None
    participant_alias: str
    study_id: uuid.UUID
    requested_by: uuid.UUID | None
    requested_by_name: str | None
    received_at: datetime
    created_at: datetime


class ErasureRequestCountsOut(BaseModel):
    entries: int
    files: int
    entry_types: dict[str, int]
    has_identity: bool
    study_participants: int
    study_entries: int


class PendingErasureRequestOut(ErasureRequestSummaryOut):
    alias: str | None
    study_title: str
    requested_by_role: StudyRole | None
    counts: ErasureRequestCountsOut
