"""Immutable input and output of the scheduler.

The scheduler is a pure library: nothing here reads the database, the network or the clock.
All times inside a planning day are in the study's time zone; a slot is a quarter of an hour
on the clock (08:00, 08:15, ...), and the end of a window or interval is exclusive.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, tzinfo
from enum import StrEnum

WEEKDAYS = frozenset(range(1, 8))  # ISO 8601: Monday is 1, Sunday is 7
DAY_PARTS = 4


class ScheduleStyle(StrEnum):
    """How a study values varied against routine times (FR-50)."""

    FIXED = "fixed"
    BALANCED = "balanced"
    VARIED = "varied"


class UnplannedReason(StrEnum):
    """The values stored in ``prompt.unplanned_reason`` (FR-35, FR-51)."""

    OUTSIDE_AVAILABILITY = "outside_availability"
    MIN_GAP_INFEASIBLE = "min_gap_infeasible"
    DAILY_CAP = "daily_cap"
    SLOT_CAP = "slot_cap"
    SEARCH_CUT = "search_cut"


class CutReason(StrEnum):
    """Why a run stopped before proving the plan optimal."""

    NODE_LIMIT = "node_limit"
    TIME_LIMIT = "time_limit"


@dataclass(frozen=True, order=True)
class PromptKey:
    """One occurrence of one activity, the unit the scheduler plans."""

    activity_id: str
    occurrence: int

    def __post_init__(self) -> None:
        if not self.activity_id:
            raise ValueError("activity_id must not be empty")
        if self.occurrence < 0:
            raise ValueError("occurrence must not be negative")


@dataclass(frozen=True)
class TimeWindow:
    """The hours of the day in which an activity may be asked."""

    start: time
    end: time

    def __post_init__(self) -> None:
        if self.start.tzinfo is not None or self.end.tzinfo is not None:
            raise ValueError("window times must be naive; the study carries the time zone")
        if self.start >= self.end:
            raise ValueError("window start must be before its end")


@dataclass(frozen=True)
class Activity:
    """What is asked each day and the rules for when it may be asked."""

    id: str
    prompts_per_day: int
    min_gap_minutes: int
    window: TimeWindow

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("activity id must not be empty")
        if self.prompts_per_day < 0:
            raise ValueError("prompts_per_day must not be negative")
        if self.min_gap_minutes < 0:
            raise ValueError("min_gap_minutes must not be negative")


@dataclass(frozen=True)
class AvailabilityInterval:
    """One interval of the participant's availability, repeated on some weekdays."""

    start: time
    end: time
    weekdays: frozenset[int]

    def __post_init__(self) -> None:
        object.__setattr__(self, "weekdays", frozenset(self.weekdays))
        if self.start.tzinfo is not None or self.end.tzinfo is not None:
            raise ValueError("availability times must be naive")
        if self.start >= self.end:
            raise ValueError("availability start must be before its end")
        if not self.weekdays:
            raise ValueError("an availability interval needs at least one weekday")
        if not self.weekdays <= WEEKDAYS:
            raise ValueError("weekdays must be in 1..7 (Monday to Sunday)")


@dataclass(frozen=True)
class Participant:
    """A participation with its declared availability (FR-05, FR-46).

    ``any_time`` means the whole activity window; the intervals are ignored then. A participant
    with neither the flag nor intervals has no availability at all, which produces
    ``outside_availability`` for every prompt.
    """

    id: str
    availability: tuple[AvailabilityInterval, ...] = ()
    any_time: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "availability", tuple(self.availability))
        if not self.id:
            raise ValueError("participant id must not be empty")


@dataclass(frozen=True)
class StudyConfig:
    """The settings of a study that the constraints and the score use."""

    id: str
    schedule_style: ScheduleStyle = ScheduleStyle.VARIED
    max_prompts_per_day: int = 4
    max_prompts_per_slot: int = 1
    time_zone: tzinfo = UTC

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("study id must not be empty")
        if self.max_prompts_per_day < 1:
            raise ValueError("max_prompts_per_day must be at least 1")
        if self.max_prompts_per_slot < 1:
            raise ValueError("max_prompts_per_slot must be at least 1")


@dataclass(frozen=True)
class FixedPrompt:
    """A prompt already sent today. It stays fixed and still uses the counters and the gap."""

    participant_id: str
    activity_id: str
    occurrence: int
    scheduled_at: datetime

    def __post_init__(self) -> None:
        if not self.participant_id or not self.activity_id:
            raise ValueError("fixed prompt ids must not be empty")
        if self.occurrence < 0:
            raise ValueError("occurrence must not be negative")


@dataclass(frozen=True)
class HistoricalPrompt:
    """A prompt of an earlier day, used by the soft preference score."""

    participant_id: str
    activity_id: str
    occurrence: int
    scheduled_at: datetime

    def __post_init__(self) -> None:
        if not self.participant_id or not self.activity_id:
            raise ValueError("historical prompt ids must not be empty")
        if self.occurrence < 0:
            raise ValueError("occurrence must not be negative")


@dataclass(frozen=True)
class RecentDayParts:
    """The parts of the day a participant already had prompts in over the last three days."""

    participant_id: str
    parts: frozenset[int]

    def __post_init__(self) -> None:
        object.__setattr__(self, "parts", frozenset(self.parts))
        if not self.participant_id:
            raise ValueError("participant id must not be empty")
        if not self.parts <= frozenset(range(DAY_PARTS)):
            raise ValueError("parts must be in 0..3")


@dataclass(frozen=True)
class History:
    """What the soft score needs to know about the previous days."""

    yesterday: tuple[HistoricalPrompt, ...] = ()
    recent_parts: tuple[RecentDayParts, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "yesterday", tuple(self.yesterday))
        object.__setattr__(self, "recent_parts", tuple(self.recent_parts))


@dataclass(frozen=True)
class StudyDay:
    """The whole input of one planning run for one study and one day."""

    study: StudyConfig
    plan_date: date
    activities: tuple[Activity, ...]
    participants: tuple[Participant, ...]
    history: History = field(default_factory=History)

    def __post_init__(self) -> None:
        object.__setattr__(self, "activities", tuple(self.activities))
        object.__setattr__(self, "participants", tuple(self.participants))


@dataclass(frozen=True)
class PlannedPrompt:
    """A prompt placed at a slot. ``fixed`` marks a prompt that was already sent today."""

    participant_id: str
    activity_id: str
    occurrence: int
    scheduled_at: datetime
    fixed: bool = False

    @property
    def key(self) -> PromptKey:
        return PromptKey(self.activity_id, self.occurrence)


@dataclass(frozen=True)
class UnplannedPrompt:
    """A prompt the scheduler could not place, with the reason stored in the database."""

    participant_id: str
    activity_id: str
    occurrence: int
    reason: UnplannedReason

    @property
    def key(self) -> PromptKey:
        return PromptKey(self.activity_id, self.occurrence)


@dataclass(frozen=True)
class DayPlan:
    """The result of one run.

    ``planned`` includes prompts already sent today (``fixed=True``). ``finished`` is false when
    a node or time limit cut the search, so the plan is the best found and not proven optimal;
    ``cut_reason`` records which limit was used. ``solve_ms`` is measured and therefore excluded
    from equality.
    """

    plan_date: date
    planned: tuple[PlannedPrompt, ...] = ()
    unplanned: tuple[UnplannedPrompt, ...] = ()
    score: float = 0.0
    finished: bool = True
    nodes_expanded: int = 0
    backtracks: int = 0
    solve_ms: int = field(default=0, compare=False)
    cut_reason: CutReason | None = None

    def __post_init__(self) -> None:
        if self.finished and self.cut_reason is not None:
            raise ValueError("a finished plan cannot have a cut reason")

    @property
    def planned_count(self) -> int:
        return len(self.planned)

    @property
    def unplanned_count(self) -> int:
        return len(self.unplanned)

    @property
    def cut(self) -> bool:
        """True when the search was cut and the plan is not proven optimal."""
        return not self.finished


__all__ = [
    "Activity",
    "AvailabilityInterval",
    "CutReason",
    "DAY_PARTS",
    "DayPlan",
    "FixedPrompt",
    "HistoricalPrompt",
    "History",
    "Participant",
    "PlannedPrompt",
    "PromptKey",
    "RecentDayParts",
    "ScheduleStyle",
    "StudyConfig",
    "StudyDay",
    "TimeWindow",
    "UnplannedPrompt",
    "UnplannedReason",
    "WEEKDAYS",
]
