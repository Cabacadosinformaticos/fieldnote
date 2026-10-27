"""Response bodies for the study overview page."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import EntryType


class OverviewParticipantCounts(BaseModel):
    total: int = 0
    active: int = 0
    pending_approval: int = 0
    declined: int = 0
    withdrawn: int = 0
    removed: int = 0


class OverviewEntryCounts(BaseModel):
    total: int = 0
    today: int = 0
    today_answered: int = 0
    today_free: int = 0


class OverviewAdherence(BaseModel):
    answered: int = 0
    sent: int = 0
    expired: int = 0
    planned: int = 0
    percentage: float = 0.0


class OverviewEntry(BaseModel):
    id: uuid.UUID
    participant_id: uuid.UUID
    participant_alias: str | None
    activity_id: uuid.UUID | None
    activity_title: str | None
    prompt_id: uuid.UUID | None
    entry_type: EntryType
    recorded_at: datetime
    received_at: datetime


class OverviewAlert(BaseModel):
    kind: Literal["pending_approval", "no_entries"]
    participant_id: uuid.UUID
    alias: str | None
    entered_at: datetime | None = None
    last_entry_at: datetime | None = None


class StudyOverviewOut(BaseModel):
    study_id: uuid.UUID
    date: date
    timezone: str
    participants: OverviewParticipantCounts
    entries: OverviewEntryCounts
    adherence_today: OverviewAdherence
    adherence_study: OverviewAdherence
    last_entries: list[OverviewEntry] = Field(default_factory=list)
    alerts: list[OverviewAlert] = Field(default_factory=list)
