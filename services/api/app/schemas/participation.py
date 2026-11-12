"""Schemas for joining with a code and for the participant side of a participation."""

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator

from app.models.enums import (
    InviteCodeKind,
    Locale,
    ParticipantStatus,
    PromptStatus,
    QuestionKind,
    StudyStatus,
    TodayFreeEntryDisplay,
)


class InvitationLookupRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    android_id: str | None = Field(default=None, max_length=128)


class StudyAnswerIn(BaseModel):
    question_id: uuid.UUID
    answer: str | list[str]


class InvitationAcceptRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    android_id: str | None = Field(default=None, max_length=128)
    locale: Locale = Locale.PT
    consent_version: str = Field(min_length=1, max_length=50)
    answers: list[StudyAnswerIn] = Field(default_factory=list)


class StudyTeamMemberOut(BaseModel):
    """A person on the study team, as the participant sees them."""

    name: str | None
    email: str


class StudyCardOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    consent_text: str | None
    status: StudyStatus
    starts_on: date | None
    ends_on: date | None
    timezone: str
    team: list[StudyTeamMemberOut]
    requests_per_day: int
    expected_minutes_per_day: int
    entry_types: list[str]
    captures_location: bool


class StudyQuestionOut(BaseModel):
    id: uuid.UUID
    position: int
    kind: QuestionKind
    text: str
    options: list[str]


class ExistingParticipationOut(BaseModel):
    status: ParticipantStatus
    alias: str | None
    can_return: bool
    can_erase: bool
    can_cancel_erasure: bool
    decided_at: datetime | None
    erasure_due_at: datetime | None


class InvitationLookupResponse(BaseModel):
    code_kind: InviteCodeKind
    study: StudyCardOut
    requires_approval: bool
    requires_account: bool
    consent_version: str
    questions: list[StudyQuestionOut]
    existing_participation: ExistingParticipationOut | None


class StudySummaryOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    consent_text: str | None
    status: StudyStatus
    starts_on: date | None
    ends_on: date | None
    timezone: str
    team: list[StudyTeamMemberOut]
    max_prompts_per_day: int
    today_free_entry_display: TodayFreeEntryDisplay


class ParticipantMeOut(BaseModel):
    id: uuid.UUID
    study: StudySummaryOut
    status: ParticipantStatus
    alias: str | None
    locale: Locale | None
    entered_at: datetime | None
    availability_any_time: bool
    has_consent: bool
    push_token_registered: bool
    erasure_requested_at: datetime | None
    erasure_due_at: datetime | None
    status_before_erasure: ParticipantStatus | None


class InvitationAcceptResponse(BaseModel):
    outcome: Literal[
        "joined",
        "returned",
        "already_participating",
        "waiting_approval",
        "pending_approval",
    ]
    device_token: str | None
    token_type: str = "Device"
    participant: ParticipantMeOut


class ApprovalStatusOut(BaseModel):
    status: ParticipantStatus
    alias: str | None
    decided_at: datetime | None


class AvailabilityIntervalIn(BaseModel):
    start_time: time
    end_time: time
    weekdays: list[int] = Field(min_length=1, max_length=7)

    @field_validator("weekdays")
    @classmethod
    def _validate_weekdays(cls, value: list[int]) -> list[int]:
        if any(day < 1 or day > 7 for day in value):
            raise ValueError("Weekdays are the numbers 1 to 7.")
        if len(set(value)) != len(value):
            raise ValueError("Weekdays cannot repeat.")
        return value

    @model_validator(mode="after")
    def _validate_interval(self) -> "AvailabilityIntervalIn":
        if self.start_time >= self.end_time:
            raise ValueError("The start time must be before the end time.")
        return self


class AvailabilityUpdate(BaseModel):
    any_time: bool = False
    intervals: list[AvailabilityIntervalIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_choice(self) -> "AvailabilityUpdate":
        if self.any_time and self.intervals:
            raise ValueError("With 'any time' there are no intervals.")
        if not self.any_time and not self.intervals:
            raise ValueError("Declare at least one interval or choose 'any time'.")
        return self


class AvailabilityIntervalOut(BaseModel):
    start_time: time
    end_time: time
    weekdays: list[int]


class AvailabilityOut(BaseModel):
    any_time: bool
    intervals: list[AvailabilityIntervalOut]


class PushTokenUpdate(BaseModel):
    push_token: str | None = Field(default=None, max_length=512)


class OpenPromptOut(BaseModel):
    id: uuid.UUID
    activity_id: uuid.UUID
    title: str
    instructions: str | None
    entry_types: list[str]
    options: dict[str, object] | None
    expected_minutes: int
    capture_location: bool
    status: PromptStatus
    scheduled_at: datetime | None
    sent_at: datetime | None
    closes_at: datetime


class OpenPromptsOut(BaseModel):
    date: date
    prompts: list[OpenPromptOut]


class PromptEventIn(BaseModel):
    """When the phone showed and opened a prompt.

    The values come from the phone clock because a report can arrive late, so each one is
    optional and only the first report of a field is kept.
    """

    shown_at: AwareDatetime | None = None
    opened_at: AwareDatetime | None = None


class FreeEntryActivityOut(BaseModel):
    """An activity the app can present for a free entry (FR-13, FR-108)."""

    id: uuid.UUID
    title: str
    instructions: str | None
    entry_types: list[str]
    options: dict[str, object] | None
    capture_location: bool
    allow_free_entries: bool
    max_free_entries_per_day: int | None
    free_entries_used_today: int


class ErasureRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=20)
