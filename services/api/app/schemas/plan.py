"""Response bodies for the researcher's view of a study day plan."""

import uuid
from datetime import date, datetime, time

from pydantic import BaseModel

from app.models.enums import PromptStatus, UnplannedReason


class PlanAvailabilityInterval(BaseModel):
    start_time: time
    end_time: time


class PlanParticipant(BaseModel):
    participant_id: uuid.UUID
    alias: str | None
    active: bool
    availability_any_time: bool
    availability: list[PlanAvailabilityInterval]


class PlanRunOut(BaseModel):
    finished: bool
    nodes_expanded: int
    planned: int
    unplanned: int
    solve_ms: int
    created_at: datetime


class PlanPrompt(BaseModel):
    prompt_id: uuid.UUID
    participant_id: uuid.UUID
    participant_alias: str | None
    activity_id: uuid.UUID
    activity_title: str
    occurrence: int
    scheduled_at: datetime | None
    sent_at: datetime | None
    status: PromptStatus
    unplanned_reason: UnplannedReason | None


class StudyPlanOut(BaseModel):
    date: date
    weekday: int
    participants: list[PlanParticipant]
    prompts: list[PlanPrompt]
    run: PlanRunOut | None = None
