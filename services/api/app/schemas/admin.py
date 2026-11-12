import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AuditActorType, ScheduleStyle, StudyRole, StudyStatus, UserRole


class AccountCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=200)
    role: UserRole = UserRole.RESEARCHER


class AccountUpdate(BaseModel):
    role: UserRole | None = None
    name: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _needs_a_change(self) -> "AccountUpdate":
        if not self.model_fields_set:
            raise ValueError("give a role or a name")
        return self


class AccountOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    role: UserRole
    state: Literal["active", "deactivated", "locked"]
    locked: bool
    locked_until: datetime | None
    studies: int
    last_session_at: datetime | None
    totp_enrolled: bool
    created_at: datetime


class AccountCreatedOut(AccountOut):
    mail_sent: bool


class AccountLinkOut(BaseModel):
    mail_sent: bool


class StudyResearcherOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str | None
    role: StudyRole


class AdminStudyOut(BaseModel):
    id: uuid.UUID
    title: str
    status: StudyStatus
    schedule_style: ScheduleStyle
    starts_on: date | None
    ends_on: date | None
    owner_email: str | None
    team: list[StudyResearcherOut]
    participants: int
    active_participants: int
    entries: int
    adherence_percentage: float | None
    adherence_period: Literal["today", "final"] | None


class AuditEventOut(BaseModel):
    id: int
    actor_type: AuditActorType
    actor_id: uuid.UUID | None
    actor_name: str | None
    action: str
    target: str | None
    details: dict[str, object] | None
    origin_client: str | None
    origin_ip: str | None
    origin_browser: str | None
    at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditEventOut]
    next_cursor: int | None
    total: int
    page_count: int


class ScheduledErasureOut(BaseModel):
    participant_id: uuid.UUID
    study_id: uuid.UUID
    study_title: str | None
    alias: str | None
    requested_at: datetime | None
    due_at: datetime | None


class CompletedErasureOut(BaseModel):
    participant_id: uuid.UUID
    study_id: uuid.UUID | None
    study_title: str | None
    actor_type: AuditActorType
    actor_id: uuid.UUID | None
    at: datetime
    entries: int
    files: int


class ErasureListOut(BaseModel):
    scheduled: list[ScheduledErasureOut]
    completed: list[CompletedErasureOut]
    next_cursor: int | None = None


class ErasureResultOut(BaseModel):
    participant_id: uuid.UUID
    entries_deleted: int
    files_deleted: int


class AdminPoolConcelhoOut(BaseModel):
    concelho: str
    members: int


class AdminPoolFieldsOut(BaseModel):
    concelho: int
    freguesia: int
    age_band: int
    gender: int
    occupation: int
    usual_transport: int
    languages: int


class AdminPoolInvitationResultsOut(BaseModel):
    study_id: uuid.UUID
    study_title: str
    sent: int
    accepted: int
    declined: int
    expired: int


class AdminPoolOverviewOut(BaseModel):
    members_total: int
    members_paused: int
    top_concelhos: int
    invitations_sent: int
    invitations_accepted: int
    concelhos: list[AdminPoolConcelhoOut]
    fields: AdminPoolFieldsOut
    invitation_results: list[AdminPoolInvitationResultsOut]
