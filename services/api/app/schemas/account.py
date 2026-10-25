"""Schemas for the optional participant account.

The account holds no name, no entries and no alias. A response never carries a recovery code after
creation and never carries an email address in clear, only its masked form.
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ParticipantStatus
from app.schemas.participation import StudySummaryOut
from app.schemas.pool import PoolMemberOut

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RecoveryAccountOut(BaseModel):
    recovery_code: str
    account_token: str
    token_type: str = "Account"
    confirmed: bool = False


class AccountLinkRequest(BaseModel):
    device_tokens: list[str] = Field(default_factory=list, max_length=50)
    pool_credential: str | None = Field(default=None, max_length=512)


class AccountConfirmRequest(AccountLinkRequest):
    pass


class RecoverySignInRequest(AccountLinkRequest):
    code: str = Field(min_length=1, max_length=40)


class EmailCodeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(cleaned):
            raise ValueError("Enter a valid email address.")
        return cleaned


class EmailVerifyRequest(AccountLinkRequest):
    email: str = Field(min_length=3, max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(cleaned):
            raise ValueError("Enter a valid email address.")
        return cleaned


class EmailCodeSentOut(BaseModel):
    detail: str


class AccountMethodsOut(BaseModel):
    recovery_code: bool
    email_masked: str | None
    # FR-99: Google sign-in is a production option and is off in the course project.
    google: bool = False


class AccountParticipationOut(BaseModel):
    participant_id: uuid.UUID
    study: StudySummaryOut
    status: ParticipantStatus
    alias: str | None
    erasure_due_at: datetime | None
    device_token: str | None = None


class AccountOut(BaseModel):
    confirmed: bool
    created_at: datetime
    methods: AccountMethodsOut
    participations: list[AccountParticipationOut]
    pool_linked: bool


class PoolRestoredOut(BaseModel):
    credential: str
    member: PoolMemberOut


class SignInOut(BaseModel):
    account_token: str
    token_type: str = "Account"
    created: bool = False
    participations: list[AccountParticipationOut]
    pool: PoolRestoredOut | None
