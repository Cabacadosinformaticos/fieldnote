"""Schemas for the volunteer pool and for recruiting from it.

A pool profile has no name, email address or phone number. Every optional field uses ``null`` for
"prefer not to say". The researcher side only ever exchanges criteria and a count, never a profile.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import (
    AgeBand,
    Gender,
    Locale,
    Occupation,
    ParticipantStatus,
    PoolInvitationStatus,
    TransportMode,
)
from app.schemas.participation import StudyAnswerIn, StudyCardOut, StudySummaryOut

MINIMUM_GROUP_SIZE = 5


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class PoolJoinRequest(BaseModel):
    """The concelho is the only required field (FR-73)."""

    concelho: str = Field(min_length=1, max_length=120)
    freguesia: str | None = Field(default=None, max_length=120)
    age_band: AgeBand | None = None
    gender: Gender | None = None
    occupation: Occupation | None = None
    usual_transport: TransportMode | None = None
    languages: list[Locale] = Field(default_factory=list)
    push_token: str | None = Field(default=None, max_length=512)

    @field_validator("concelho")
    @classmethod
    def _validate_concelho(cls, value: str) -> str:
        cleaned = _clean(value)
        if cleaned is None:
            raise ValueError("Choose a concelho.")
        return cleaned

    @field_validator("freguesia")
    @classmethod
    def _normalise_freguesia(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("languages")
    @classmethod
    def _validate_languages(cls, value: list[Locale]) -> list[Locale]:
        return list(dict.fromkeys(value))


class PoolProfileUpdate(BaseModel):
    """A PATCH: an absent field is unchanged and an explicit ``null`` clears it."""

    concelho: str | None = Field(default=None, max_length=120)
    freguesia: str | None = Field(default=None, max_length=120)
    age_band: AgeBand | None = None
    gender: Gender | None = None
    occupation: Occupation | None = None
    usual_transport: TransportMode | None = None
    languages: list[Locale] | None = None
    invitations_paused: bool | None = None
    push_token: str | None = Field(default=None, max_length=512)

    @field_validator("concelho")
    @classmethod
    def _validate_concelho(cls, value: str | None) -> str | None:
        cleaned = _clean(value)
        if cleaned is None:
            raise ValueError("Choose a concelho.")
        return cleaned

    @field_validator("freguesia")
    @classmethod
    def _normalise_freguesia(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("languages")
    @classmethod
    def _validate_languages(cls, value: list[Locale] | None) -> list[Locale] | None:
        return None if value is None else list(dict.fromkeys(value))


class PoolMemberOut(BaseModel):
    concelho: str
    freguesia: str | None
    age_band: AgeBand | None
    gender: Gender | None
    occupation: Occupation | None
    usual_transport: TransportMode | None
    languages: list[str] | None
    invitations_paused: bool
    joined_at: datetime
    account_linked: bool


class PoolJoinOut(PoolMemberOut):
    credential: str
    token_type: str = "Pool"


class PoolCriteria(BaseModel):
    """The criteria a researcher sets; every field is optional and narrows the group."""

    concelho: str | None = Field(default=None, max_length=120)
    freguesia: str | None = Field(default=None, max_length=120)
    age_band: AgeBand | None = None
    gender: Gender | None = None
    occupation: Occupation | None = None
    usual_transport: TransportMode | None = None
    language: Locale | None = None

    @field_validator("concelho", "freguesia")
    @classmethod
    def _normalise_text(cls, value: str | None) -> str | None:
        return _clean(value)


class PoolCountOut(BaseModel):
    # None means "fewer than 5": a small group is never shown as a number (NFR-68).
    count: int | None
    minimum: int = MINIMUM_GROUP_SIZE


class PoolSendOut(BaseModel):
    sent: int
    expires_at: datetime


class PoolInvitationOut(BaseModel):
    id: uuid.UUID
    status: PoolInvitationStatus
    reason: str
    concelho: str
    sent_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    study: StudyCardOut


class PoolInvitationAcceptRequest(BaseModel):
    android_id: str | None = Field(default=None, max_length=128)
    locale: Locale = Locale.PT
    consent_version: str = Field(min_length=1, max_length=50)
    answers: list[StudyAnswerIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _require_consent(self) -> "PoolInvitationAcceptRequest":
        if not self.consent_version.strip():
            raise ValueError("The consent version is required.")
        return self


class PoolJoinedParticipantOut(BaseModel):
    id: uuid.UUID
    study: StudySummaryOut
    alias: str | None
    status: ParticipantStatus
    has_consent: bool


class PoolInvitationAcceptOut(BaseModel):
    outcome: Literal["joined"]
    device_token: str
    token_type: str = "Device"
    participant: PoolJoinedParticipantOut
