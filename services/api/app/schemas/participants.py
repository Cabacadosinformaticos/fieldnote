import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import Locale, ParticipantStatus


class ParticipantCreate(BaseModel):
    alias: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)


class PersonalInviteCodeOut(BaseModel):
    code: str
    expires_at: datetime


class AvailabilityIntervalOut(BaseModel):
    start_time: time
    end_time: time
    weekdays: list[int]


class AvailabilitySummaryOut(BaseModel):
    any_time: bool
    intervals: list[AvailabilityIntervalOut]


class ParticipantOut(BaseModel):
    id: uuid.UUID
    alias: str | None
    status: ParticipantStatus
    entered_at: datetime | None
    erasure_due_at: datetime | None
    entry_route: str | None
    consented_at: datetime | None = None
    locale: Locale | None = None
    availability_summary: AvailabilitySummaryOut | None = None
    last_entry_at: datetime | None = None
    # Set only while the person has not accepted the invitation yet (UC10 postcondition).
    invite_state: Literal["unused", "expired"] | None = None


class ParticipantAddedOut(ParticipantOut):
    invite_code: PersonalInviteCodeOut


class ParticipantIdentityOut(BaseModel):
    name: str | None
    email: str | None


class ApprovalOut(BaseModel):
    """A waiting entry, shown without an alias, an identity or any answer."""

    order: int
    participant_id: uuid.UUID
    entered_at: datetime | None
    invite_code_id: uuid.UUID | None
    code: str | None
