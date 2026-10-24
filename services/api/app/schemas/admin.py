import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import AuditActorType, StudyRole, StudyStatus, UserRole


class AccountCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: UserRole = UserRole.RESEARCHER


class AccountRoleUpdate(BaseModel):
    role: UserRole


class AccountOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    locked: bool
    locked_until: datetime | None
    totp_enrolled: bool
    created_at: datetime


class AccountCreatedOut(AccountOut):
    temporary_password: str


class StudyResearcherOut(BaseModel):
    user_id: uuid.UUID
    email: str
    role: StudyRole


class AdminStudyOut(BaseModel):
    id: uuid.UUID
    title: str
    status: StudyStatus
    starts_on: date | None
    ends_on: date | None
    owner_email: str | None
    team: list[StudyResearcherOut]
    participants: int
    entries: int


class AuditEventOut(BaseModel):
    id: int
    actor_type: AuditActorType
    actor_id: uuid.UUID | None
    action: str
    target: str | None
    details: dict[str, object] | None
    at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditEventOut]
    next_cursor: int | None


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


class ErasureResultOut(BaseModel):
    participant_id: uuid.UUID
    entries_deleted: int
    files_deleted: int
