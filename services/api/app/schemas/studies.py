"""Request and response bodies for studies, their team, questions and tags."""

import uuid
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    QuestionKind,
    ScheduleStyle,
    StudyRole,
    StudyStatus,
    TodayFreeEntryDisplay,
)


def _required_text(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be empty")
    return stripped


def _timezone(value: str) -> str:
    name = value.strip()
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("must be a known IANA time zone") from exc
    return name


def validate_question(kind: QuestionKind, text: str, options: list[str]) -> tuple[str, list[str]]:
    """Check the question against FR-112 and return the normalised text and options."""
    text = _required_text(text)
    cleaned: list[str] = []
    for option in options:
        value = option.strip()
        if not value:
            raise ValueError("options must not be empty")
        cleaned.append(value)

    if kind in (QuestionKind.SINGLE_CHOICE, QuestionKind.MULTIPLE_CHOICE):
        if len(cleaned) < 2:
            raise ValueError("a choice question needs at least two options")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("options must be unique")
    elif cleaned:
        raise ValueError("only choice questions have options")
    return text, cleaned


class StudyCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    timezone: str = Field(min_length=1)
    max_prompts_per_day: int = Field(ge=1)
    max_prompts_per_slot: int = Field(ge=1)
    schedule_style: ScheduleStyle
    today_free_entry_display: TodayFreeEntryDisplay | None = None
    consent_text: str | None = None
    collaborators: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _required_text(value)

    @field_validator("timezone")
    @classmethod
    def _validate_timezone(cls, value: str) -> str:
        return _timezone(value)

    @model_validator(mode="after")
    def _validate_dates(self) -> "StudyCreate":
        if self.starts_on and self.ends_on and self.starts_on > self.ends_on:
            raise ValueError("starts_on must not be after ends_on")
        return self


class StudyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    timezone: str | None = None
    max_prompts_per_day: int | None = None
    max_prompts_per_slot: int | None = None
    schedule_style: ScheduleStyle | None = None
    today_free_entry_display: TodayFreeEntryDisplay | None = None
    consent_text: str | None = None


class StudyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    status: StudyStatus
    starts_on: date | None
    ends_on: date | None
    timezone: str
    max_prompts_per_day: int
    max_prompts_per_slot: int
    schedule_style: ScheduleStyle
    today_free_entry_display: TodayFreeEntryDisplay
    consent_text: str | None = None


class StudyAdherenceOut(BaseModel):
    answered: int = 0
    out: int = 0
    percentage: float = 0.0


class StudyListItemOut(StudyOut):
    """A study on the dashboard list, with the counts the cards show."""

    entry_count: int
    participant_count: int
    adherence_today: StudyAdherenceOut
    adherence_study: StudyAdherenceOut


class StudyMemberCreate(BaseModel):
    email: str = Field(min_length=3)
    role: StudyRole


class StudyMemberUpdate(BaseModel):
    role: StudyRole


class StudyMemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    role: StudyRole


class StudyQuestionCreate(BaseModel):
    kind: QuestionKind
    text: str = Field(min_length=1)
    options: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_question(self) -> "StudyQuestionCreate":
        self.text, self.options = validate_question(self.kind, self.text, self.options)
        return self


class StudyQuestionUpdate(BaseModel):
    kind: QuestionKind | None = None
    text: str | None = None
    options: list[str] | None = None

    @model_validator(mode="after")
    def _no_explicit_nulls(self) -> "StudyQuestionUpdate":
        for field in ("kind", "text", "options"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class StudyQuestionOrder(BaseModel):
    question_ids: list[uuid.UUID]


class StudyQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    kind: QuestionKind
    text: str
    options: list[str]


class TagCreate(BaseModel):
    name: str = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        return _required_text(value)


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class StudyConsentOut(BaseModel):
    """The consent version in use and how many active participants accepted it."""

    version: str
    accepted: int
