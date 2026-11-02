"""Response models for the researcher views of entries, timeline and adherence."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import EntryType, MediaStatus, PromptStatus


class TagOut(BaseModel):
    id: uuid.UUID
    name: str


class MediaOut(BaseModel):
    id: uuid.UUID
    mime_type: str
    size_bytes: int
    status: MediaStatus
    url: str | None = None
    url_expires_at: datetime | None = None
    thumbnail_url: str | None = None
    thumbnail_url_expires_at: datetime | None = None


class EntryOut(BaseModel):
    id: uuid.UUID
    participant_id: uuid.UUID
    participant_alias: str | None
    activity_id: uuid.UUID | None
    activity_title: str | None
    prompt_id: uuid.UUID | None
    entry_type: EntryType
    body: str | None
    value: int | None
    scale_shown: dict[str, object] | None
    choice: str | None
    latitude: float | None
    longitude: float | None
    recorded_at: datetime
    received_at: datetime
    tags: list[TagOut] = Field(default_factory=list)
    media: list[MediaOut] = Field(default_factory=list)


class EntryListResponse(BaseModel):
    items: list[EntryOut]
    next_cursor: str | None = None
    total: int


class EntryTagsUpdate(BaseModel):
    tag_ids: list[uuid.UUID] = Field(default_factory=list)


class MediaRetryOut(BaseModel):
    entry_id: uuid.UUID
    media_ids: list[uuid.UUID]


class EntryTagsOut(BaseModel):
    entry_id: uuid.UUID
    tags: list[TagOut] = Field(default_factory=list)


class TimelineEntry(BaseModel):
    id: uuid.UUID
    participant_id: uuid.UUID
    activity_id: uuid.UUID | None
    prompt_id: uuid.UUID | None
    entry_type: EntryType
    recorded_at: datetime
    tag_ids: list[uuid.UUID] = Field(default_factory=list)
    media_count: int = 0


class TimelineMarker(BaseModel):
    prompt_id: uuid.UUID
    activity_id: uuid.UUID
    status: PromptStatus
    scheduled_at: datetime | None
    sent_at: datetime | None
    hollow: bool = True


class TimelineLane(BaseModel):
    participant_id: uuid.UUID
    alias: str | None
    entries: list[TimelineEntry] = Field(default_factory=list)
    markers: list[TimelineMarker] = Field(default_factory=list)


class TimelineResponse(BaseModel):
    zoom: Literal["week", "day", "hours"]
    start: datetime
    end: datetime
    lanes: list[TimelineLane]


class AdherencePrompt(BaseModel):
    prompt_id: uuid.UUID
    activity_id: uuid.UUID
    status: PromptStatus
    scheduled_at: datetime | None
    sent_at: datetime | None
    shown_at: datetime | None
    opened_at: datetime | None


class AdherenceCell(BaseModel):
    occurrence: int
    state: Literal["answered", "expired", "sent_pending", "not_sent"]
    prompts: list[AdherencePrompt] = Field(default_factory=list)


class AdherenceDay(BaseModel):
    date: date
    cells: list[AdherenceCell] = Field(default_factory=list)
    free_entries: int = 0


class AdherenceParticipant(BaseModel):
    id: uuid.UUID
    alias: str | None


class AdherenceSummary(BaseModel):
    answered: int
    expired: int
    sent_pending: int
    not_sent: int
    denominator: int
    percentage: float


class AdherenceResponse(BaseModel):
    participant: AdherenceParticipant
    days: list[AdherenceDay]
    slots: list[int]
    states: list[Literal["answered", "expired", "sent_pending", "not_sent"]]
    summary: AdherenceSummary
