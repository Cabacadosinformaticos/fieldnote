"""Request and response bodies for activities and their response scales."""

import uuid
from datetime import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import EntryType

ScaleType = Literal["numbers", "faces", "text", "slider"]


class ActivityOptions(BaseModel):
    """The response scale of an activity that accepts the scale entry type (FR-111)."""

    model_config = ConfigDict(extra="forbid")

    scale_type: ScaleType
    points: int | None = None
    start_label: str | None = None
    end_label: str | None = None
    middle_label: str | None = None

    @field_validator("start_label", "end_label", "middle_label")
    @classmethod
    def _strip_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


def validate_options(entry_types: list[EntryType], options: ActivityOptions | None) -> None:
    """Check the response scale against FR-111."""
    if EntryType.SCALE not in entry_types:
        if options is not None:
            raise ValueError("options are only allowed when the scale entry type is accepted")
        return
    if options is None:
        raise ValueError("a response scale is required when the scale entry type is accepted")

    points = options.points
    if options.scale_type == "slider":
        if points is not None:
            raise ValueError("the slider scale has no number of points")
        if options.middle_label is not None:
            raise ValueError("the slider scale has no middle label")
    elif options.scale_type == "numbers":
        if points is None or not 2 <= points <= 11:
            raise ValueError("a numbers scale has 2 to 11 points")
    elif options.scale_type == "faces":
        if points not in (3, 5):
            raise ValueError("a faces scale has 3 or 5 points")
    elif options.scale_type == "text" and points not in (3, 5, 7):
        raise ValueError("a text scale has 3, 5 or 7 points")

    if points is not None and points % 2 == 0 and options.middle_label is not None:
        raise ValueError("only an odd number of points has a middle label")
    if options.scale_type in ("numbers", "text") and (
        options.start_label is None or options.end_label is None
    ):
        raise ValueError("a numbers or text scale requires the labels of both ends")


class ActivityCreate(BaseModel):
    title: str = Field(min_length=1)
    instructions: str | None = None
    entry_types: list[EntryType]
    options: ActivityOptions | None = None
    prompts_per_day: int = Field(ge=1)
    window_start: time
    window_end: time
    min_gap_minutes: int = Field(ge=0)
    capture_location: bool = False
    allow_free_entries: bool = False
    max_free_entries_per_day: int | None = Field(default=None, ge=1)
    expected_minutes: int = Field(ge=1)

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be empty")
        return stripped

    @field_validator("entry_types")
    @classmethod
    def _validate_entry_types(cls, value: list[EntryType]) -> list[EntryType]:
        if not value:
            raise ValueError("at least one entry type is required")
        if len(set(value)) != len(value):
            raise ValueError("entry types must be unique")
        return value

    @model_validator(mode="after")
    def _validate_activity(self) -> "ActivityCreate":
        if self.window_start >= self.window_end:
            raise ValueError("window_start must be before window_end")
        if not self.allow_free_entries and self.max_free_entries_per_day is not None:
            raise ValueError("max_free_entries_per_day requires allow_free_entries")
        validate_options(self.entry_types, self.options)
        return self


class ActivityUpdate(BaseModel):
    title: str | None = None
    instructions: str | None = None
    entry_types: list[EntryType] | None = None
    options: ActivityOptions | None = None
    prompts_per_day: int | None = None
    window_start: time | None = None
    window_end: time | None = None
    min_gap_minutes: int | None = None
    capture_location: bool | None = None
    allow_free_entries: bool | None = None
    max_free_entries_per_day: int | None = None
    expected_minutes: int | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    title: str
    instructions: str | None
    entry_types: list[EntryType]
    options: ActivityOptions | None
    prompts_per_day: int
    window_start: time
    window_end: time
    min_gap_minutes: int
    capture_location: bool
    allow_free_entries: bool
    max_free_entries_per_day: int | None
    expected_minutes: int
