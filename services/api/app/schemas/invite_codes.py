import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class StudyCodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    end_date: date
    max_uses: int | None = Field(default=None, ge=1)
    max_per_hour: int | None = Field(default=None, ge=1)
    requires_approval: bool = True
    requires_account: bool = False


class StudyCodeUpdate(BaseModel):
    """Patch-like body: an absent field is left alone, an explicit null clears a limit."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    end_date: date | None = None
    max_uses: int | None = Field(default=None, ge=1)
    max_per_hour: int | None = Field(default=None, ge=1)
    requires_approval: bool | None = None
    requires_account: bool | None = None
    active: bool | None = None


class StudyCodeOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    max_uses: int | None
    max_per_hour: int | None
    uses: int
    expires_at: datetime
    active: bool
    requires_approval: bool
    requires_account: bool
    created_by: uuid.UUID | None
    created_at: datetime
    state: str
    waiting_count: int
    approved_count: int
    declined_count: int
