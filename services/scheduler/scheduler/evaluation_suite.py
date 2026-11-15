"""Full reproducible evaluation of the Fieldnote CSP scheduler (scheduler.md:143-181).

Run from ``services/scheduler``::

    uv run python -m scheduler.evaluation_suite [--quick] [--out DIR]

The full run writes ``results.md`` (the tables for the final report) and ``results.json`` (the
raw numbers) to ``evaluation/``. The numbers are deterministic for the same command; only the
columns marked as machine-dependent (wall-clock times) change between machines and runs.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import time as clock
from collections import Counter, defaultdict, deque
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta, tzinfo
from pathlib import Path
from typing import Any

from .domains import (
    DAY_PART_END,
    DAY_PART_START,
    SLOT_MINUTES,
    minute_of_day,
    minute_to_time,
    part_of_slot,
    prompt_slot_indexes,
    slot_datetime,
    window_slot_indexes,
)
from .evaluate import VARIANT_OPTIONS
from .generator import DEFAULT_PLAN_DATE, generate_study
from .model import (
    Activity,
    AvailabilityInterval,
    DayPlan,
    HistoricalPrompt,
    History,
    Participant,
    PlannedPrompt,
    RecentDayParts,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    TimeWindow,
    UnplannedPrompt,
    UnplannedReason,
)
from .plan import plan_day
from .solver import DEFAULT_NODE_LIMIT, SearchOptions, score_plan, style_weights

DEFAULT_SEED = 2026
ACTIVITY_COUNT = 4
COVERAGE_DAYS = 7
QUALITY_SEED = 4242
QUALITY_STUDIES = 300
QUICK_QUALITY_STUDIES = 60
QUALITY_MAX_PROMPTS = 5
ROBUSTNESS_NODE_LIMIT = 20_000
ABLATION_NODE_LIMIT = 20_000
SCALE_BUDGETS = (1_000, 10_000, 100_000, 1_000_000)
QUICK_SCALE_BUDGETS = (1_000, 10_000, 100_000)
ENTRY_TYPE_WEIGHTS = {"video": 5, "photo": 2, "audio": 2, "text": 1}
"""Weight of one prompt in the load tables, by entry type (scheduler.md entry types)."""

BASELINE_METHODS = ("scheduler", "fixed_hours")


@dataclass(frozen=True)
class EvaluationConfig:
    """Which sizes, seeds and budgets the run uses; ``quick`` is a smoke-test mode."""

    quick: bool = False
    seed: int = DEFAULT_SEED

    @property
    def load_sizes(self) -> tuple[int, ...]:
        return (10, 50) if self.quick else (10, 50, 100)

    @property
    def scale_sizes(self) -> tuple[int, ...]:
        return (10, 50) if self.quick else (10, 50, 100)

    @property
    def scale_budgets(self) -> tuple[int, ...]:
        return QUICK_SCALE_BUDGETS if self.quick else SCALE_BUDGETS

    @property
    def robustness_seeds(self) -> tuple[int, ...]:
        return (1, 2, 3) if self.quick else tuple(range(1, 11))

    @property
    def ablation_sizes(self) -> tuple[int, ...]:
        return (6, 10) if self.quick else (6, 10, 100)

    @property
    def ablation_seeds(self) -> tuple[int, ...]:
        return (1, 2, 3) if self.quick else (1, 2, 3, 4, 5)

    @property
    def quality_studies(self) -> int:
        return QUICK_QUALITY_STUDIES if self.quick else QUALITY_STUDIES


# -- 1. Fixed-hours baseline and plan validation ---------------------------------------------


def fixed_hours_baseline(study_day: StudyDay) -> DayPlan:
    """Plan every participant at the same clock times, like a fixed-hours diary tool.

    For each activity with ``n`` prompts, occurrence ``k`` goes to the slot at position
    ``(k + 1) / (n + 1)`` of the activity window, rounded down to a 15-minute slot. A prompt is
    kept only when its slot is inside the participant's availability and the participant's daily
    cap is not exceeded. The slot cap and the minimum gap are ignored on purpose.
    """
    activities = tuple(sorted(study_day.activities, key=lambda item: item.id))
    participants = tuple(sorted(study_day.participants, key=lambda item: item.id))
    time_zone = study_day.study.time_zone
    daily: dict[str, int] = {}
    planned: list[PlannedPrompt] = []
    unplanned: list[UnplannedPrompt] = []
    for participant in participants:
        daily[participant.id] = 0
        for activity in activities:
            for occurrence in range(activity.prompts_per_day):
                slot_index = _baseline_slot(activity, occurrence)
                available = slot_index is not None and slot_index in prompt_slot_indexes(
                    participant, activity, study_day.plan_date
                )
                if not available:
                    unplanned.append(
                        UnplannedPrompt(
                            participant.id,
                            activity.id,
                            occurrence,
                            UnplannedReason.OUTSIDE_AVAILABILITY,
                        )
                    )
                    continue
                if daily[participant.id] >= study_day.study.max_prompts_per_day:
                    unplanned.append(
                        UnplannedPrompt(
                            participant.id,
                            activity.id,
                            occurrence,
                            UnplannedReason.DAILY_CAP,
                        )
                    )
                    continue
                daily[participant.id] += 1
                planned.append(
                    PlannedPrompt(
                        participant.id,
                        activity.id,
                        occurrence,
                        slot_datetime(study_day.plan_date, slot_index, time_zone),
                    )
                )
    planned.sort(key=_prompt_sort_key)
    unplanned.sort(key=_unplanned_sort_key)
    return DayPlan(
        plan_date=study_day.plan_date,
        planned=tuple(planned),
        unplanned=tuple(unplanned),
        score=score_plan(planned, study_day.study, study_day.history),
    )


def _baseline_slot(activity: Activity, occurrence: int) -> int | None:
    """The fixed hours of one occurrence: a fraction of the activity window, floored to a slot."""
    slots = window_slot_indexes(activity.window)
    if not slots:
        return None
    position = (occurrence + 1) * len(slots) // (activity.prompts_per_day + 1)
    return slots[min(position, len(slots) - 1)]


@dataclass(frozen=True)
class ViolationCounts:
    """Hard-constraint violations found by :func:`count_violations`."""

    outside_availability: int = 0
    daily_cap: int = 0
    slot_cap: int = 0
    min_gap: int = 0

    @property
    def total(self) -> int:
        return self.outside_availability + self.daily_cap + self.slot_cap + self.min_gap


def count_violations(study_day: StudyDay, planned: Iterable[PlannedPrompt]) -> ViolationCounts:
    """Count the hard-constraint violations of a set of planned prompts.

    A daily-cap or slot-cap violation counts the prompts above the cap (``count - cap`` per
    participant or slot); a minimum-gap violation counts the pairs closer than their gap.
    """
    activities = {activity.id: activity for activity in study_day.activities}
    participants = {participant.id: participant for participant in study_day.participants}
    time_zone = study_day.study.time_zone
    daily: Counter[str] = Counter()
    slots: Counter[int] = Counter()
    by_participant: dict[str, list[PlannedPrompt]] = defaultdict(list)
    outside = 0
    for prompt in planned:
        activity = activities[prompt.activity_id]
        participant = participants[prompt.participant_id]
        slot_index = minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES
        if slot_index not in prompt_slot_indexes(participant, activity, study_day.plan_date):
            outside += 1
        daily[prompt.participant_id] += 1
        slots[slot_index] += 1
        by_participant[prompt.participant_id].append(prompt)

    min_gap = 0
    for prompts in by_participant.values():
        for index, left in enumerate(prompts):
            for right in prompts[index + 1 :]:
                gap = max(
                    activities[left.activity_id].min_gap_minutes,
                    activities[right.activity_id].min_gap_minutes,
                )
                distance = abs((left.scheduled_at - right.scheduled_at).total_seconds()) / 60
                if distance < gap:
                    min_gap += 1
    return ViolationCounts(
        outside_availability=outside,
        daily_cap=sum(
            max(0, count - study_day.study.max_prompts_per_day) for count in daily.values()
        ),
        slot_cap=sum(
            max(0, count - study_day.study.max_prompts_per_slot) for count in slots.values()
        ),
        min_gap=min_gap,
    )


def validate_plan(study_day: StudyDay, plan: DayPlan) -> ViolationCounts:
    """Check the structure and the score of a plan, and return its hard-constraint violations.

    This is the module's own equivalent of the test-suite validator: every requested prompt is
    planned or unplanned exactly once, non-fixed prompts sit on a slot of the plan date, the
    score matches :func:`score_plan`, and a finished search reports no ``search_cut``. The
    scheduler plans must have zero violations; the fixed-hours baseline is expected to violate
    only the slot cap and the minimum gap.
    """
    activities = {activity.id: activity for activity in study_day.activities}
    participants = {participant.id: participant for participant in study_day.participants}
    expected = {
        (participant.id, activity.id, occurrence)
        for participant in study_day.participants
        for activity in study_day.activities
        for occurrence in range(activity.prompts_per_day)
    }
    planned_keys = [
        (prompt.participant_id, prompt.activity_id, prompt.occurrence) for prompt in plan.planned
    ]
    unplanned_keys = [
        (prompt.participant_id, prompt.activity_id, prompt.occurrence) for prompt in plan.unplanned
    ]
    assert len(planned_keys) == len(set(planned_keys)), "duplicate planned prompt"
    assert len(unplanned_keys) == len(set(unplanned_keys)), "duplicate unplanned prompt"
    assert set(planned_keys) | set(unplanned_keys) == expected, "prompt set does not match input"
    assert not set(planned_keys) & set(unplanned_keys), "a prompt is planned and unplanned"

    time_zone = study_day.study.time_zone
    for prompt in plan.planned:
        assert prompt.participant_id in participants
        assert prompt.activity_id in activities
        local = prompt.scheduled_at
        local = (
            local.replace(tzinfo=time_zone) if local.tzinfo is None else local.astimezone(time_zone)
        )
        if not prompt.fixed:
            assert local.date() == study_day.plan_date, "a planned prompt is not on the plan date"
            assert local.second == 0 and local.microsecond == 0, "a planned prompt is off-slot"
    assert all(isinstance(prompt.reason, UnplannedReason) for prompt in plan.unplanned)
    if plan.finished:
        assert all(prompt.reason is not UnplannedReason.SEARCH_CUT for prompt in plan.unplanned), (
            "a finished search cannot report search_cut"
        )
    assert plan.score == score_plan(plan.planned, study_day.study, study_day.history), (
        "score does not match score_plan"
    )
    return count_violations(study_day, plan.planned)


# -- 2. Load and fairness --------------------------------------------------------------------


def entry_type_weights(study_day: StudyDay, seed: int) -> dict[str, int]:
    """Assign one entry type per activity deterministically, as a stand-in for the model field.

    ``Activity`` does not carry an entry type yet, so this helper draws the type from ``seed`` in
    activity-id order (video 5, photo 2, audio 2, text 1). Replace it with the real field when the
    model has one.
    """
    rng = random.Random(seed)
    names = tuple(ENTRY_TYPE_WEIGHTS)
    return {
        activity.id: ENTRY_TYPE_WEIGHTS[rng.choice(names)]
        for activity in sorted(study_day.activities, key=lambda item: item.id)
    }


@dataclass(frozen=True)
class LoadMetrics:
    """How the prompts of one plan spread over the day."""

    planned: int
    peak_prompts_per_slot: int
    weighted_peak_per_slot: int
    weighted_variance_08_22: float
    slots_over_cap: int


def load_metrics(
    study_day: StudyDay, planned: Sequence[PlannedPrompt], weights: dict[str, int]
) -> LoadMetrics:
    """Compute the load measures of one plan.

    The weighted variance is the population variance over the 56 slots of 08:00-22:00, with
    empty slots included; the peak measures look at the whole day.
    """
    time_zone = study_day.study.time_zone
    first_slot = DAY_PART_START // SLOT_MINUTES
    last_slot = DAY_PART_END // SLOT_MINUTES
    counts: Counter[int] = Counter()
    loads = [0] * (last_slot - first_slot)
    for prompt in planned:
        slot_index = minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES
        counts[slot_index] += 1
        if first_slot <= slot_index < last_slot:
            loads[slot_index - first_slot] += weights[prompt.activity_id]
    return LoadMetrics(
        planned=len(planned),
        peak_prompts_per_slot=max(counts.values(), default=0),
        weighted_peak_per_slot=max(loads, default=0),
        weighted_variance_08_22=statistics.pvariance(loads),
        slots_over_cap=sum(
            1 for count in counts.values() if count > study_day.study.max_prompts_per_slot
        ),
    )


@dataclass(frozen=True)
class FairnessMetrics:
    """Distribution of the planned prompts over the participants."""

    planned_min: int
    planned_mean: float
    planned_max: int
    planned_std: float
    gini: float
    ratio_min: float
    ratio_mean: float
    planned_per_participant: tuple[int, ...]


def fairness_metrics(study_day: StudyDay, planned: Sequence[PlannedPrompt]) -> FairnessMetrics:
    """Compute the distribution of planned prompts per participant.

    Participants with zero planned prompts are included. ``planned/requested`` compares the plan
    with the sum of ``prompts_per_day`` over the activities. The standard deviation is population.
    """
    participants = tuple(sorted(study_day.participants, key=lambda item: item.id))
    counts = {participant.id: 0 for participant in participants}
    for prompt in planned:
        counts[prompt.participant_id] += 1
    values = [counts[participant.id] for participant in participants]
    requested = sum(activity.prompts_per_day for activity in study_day.activities)
    ratios = [count / requested if requested else 1.0 for count in values]
    return FairnessMetrics(
        planned_min=min(values, default=0),
        planned_mean=statistics.fmean(values) if values else 0.0,
        planned_max=max(values, default=0),
        planned_std=statistics.pstdev(values) if len(values) > 1 else 0.0,
        gini=_gini(values),
        ratio_min=min(ratios, default=0.0),
        ratio_mean=statistics.fmean(ratios) if ratios else 0.0,
        planned_per_participant=tuple(values),
    )


def _gini(values: Sequence[int]) -> float:
    """The Gini coefficient of a distribution; zero when every value is equal or the total is 0."""
    count = len(values)
    total = sum(values)
    if count == 0 or total == 0:
        return 0.0
    ordered = sorted(values)
    weighted = sum(position * value for position, value in enumerate(ordered, start=1))
    return (2 * weighted) / (count * total) - (count + 1) / count


# -- 3. Seven-day coverage -------------------------------------------------------------------


@dataclass(frozen=True)
class CoverageMetrics:
    """Parts of the day covered over several days, one participant row per list entry."""

    parts_mean: float
    parts_min: int
    share_all_allowed: float
    mean_daily_score: float
    parts_per_participant: tuple[int, ...]
    allowed_parts_per_participant: tuple[int, ...]
    daily_scores: tuple[float, ...]


def run_coverage_chain(
    study_day: StudyDay, *, method: str, days: int, node_limit: int
) -> CoverageMetrics:
    """Plan ``days`` consecutive days, feeding each day the history of that method's own plans.

    ``method`` is ``"scheduler"`` or ``"fixed_hours"``. Yesterday's prompts and the parts of the
    day covered in the last three days come from the plans of the same method, so each policy is
    evaluated as a chain rather than against a mixed history.
    """
    if method not in BASELINE_METHODS:
        raise ValueError(f"unknown method {method!r}")
    time_zone = study_day.study.time_zone
    participant_ids = tuple(
        participant.id for participant in sorted(study_day.participants, key=lambda item: item.id)
    )
    recent: dict[str, deque[frozenset[int]]] = {
        participant_id: deque(maxlen=3) for participant_id in participant_ids
    }
    covered: dict[str, set[int]] = {participant_id: set() for participant_id in participant_ids}
    allowed: dict[str, set[int]] = {participant_id: set() for participant_id in participant_ids}
    scores: list[float] = []
    previous_planned: tuple[PlannedPrompt, ...] = ()
    for offset in range(days):
        plan_date = DEFAULT_PLAN_DATE + timedelta(days=offset)
        history = History(
            yesterday=tuple(
                HistoricalPrompt(
                    prompt.participant_id,
                    prompt.activity_id,
                    prompt.occurrence,
                    prompt.scheduled_at,
                )
                for prompt in previous_planned
            ),
            recent_parts=tuple(
                RecentDayParts(participant_id, _union_parts(recent[participant_id]))
                for participant_id in participant_ids
            ),
        )
        day = replace(study_day, plan_date=plan_date, history=history)
        if method == "scheduler":
            plan = plan_day(day, seed=DEFAULT_SEED, node_limit=node_limit)
            violations = validate_plan(day, plan)
            if violations.total:
                raise AssertionError(f"coverage day {plan_date} has violations: {violations}")
        else:
            plan = fixed_hours_baseline(day)
            validate_plan(day, plan)
        parts = _parts_by_participant(plan.planned, participant_ids, time_zone)
        for participant_id in participant_ids:
            covered[participant_id].update(parts[participant_id])
            recent[participant_id].append(frozenset(parts[participant_id]))
            allowed[participant_id].update(_allowed_parts(day, participant_id))
        scores.append(plan.score)
        previous_planned = plan.planned

    part_counts = [len(covered[participant_id]) for participant_id in participant_ids]
    allowed_counts = [len(allowed[participant_id]) for participant_id in participant_ids]
    with_allowed = [participant_id for participant_id in participant_ids if allowed[participant_id]]
    share = (
        sum(
            1
            for participant_id in with_allowed
            if allowed[participant_id] <= covered[participant_id]
        )
        / len(with_allowed)
        if with_allowed
        else 0.0
    )
    return CoverageMetrics(
        parts_mean=statistics.fmean(part_counts) if part_counts else 0.0,
        parts_min=min(part_counts, default=0),
        share_all_allowed=share,
        mean_daily_score=statistics.fmean(scores) if scores else 0.0,
        parts_per_participant=tuple(part_counts),
        allowed_parts_per_participant=tuple(allowed_counts),
        daily_scores=tuple(scores),
    )


def _union_parts(history: Iterable[frozenset[int]]) -> frozenset[int]:
    parts: set[int] = set()
    for item in history:
        parts.update(item)
    return frozenset(parts)


def _parts_by_participant(
    planned: Iterable[PlannedPrompt],
    participant_ids: Sequence[str],
    time_zone: tzinfo,
) -> dict[str, set[int]]:
    parts: dict[str, set[int]] = {participant_id: set() for participant_id in participant_ids}
    for prompt in planned:
        part = part_of_slot(minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES)
        if part is not None:
            parts[prompt.participant_id].add(part)
    return parts


def _allowed_parts(study_day: StudyDay, participant_id: str) -> set[int]:
    participant = next(
        participant for participant in study_day.participants if participant.id == participant_id
    )
    parts: set[int] = set()
    for activity in study_day.activities:
        for slot_index in prompt_slot_indexes(participant, activity, study_day.plan_date):
            part = part_of_slot(slot_index)
            if part is not None:
                parts.add(part)
    return parts


# -- 4. Quality against an exhaustive search -------------------------------------------------


def generate_small_study(seed: int, *, max_total_prompts: int = QUALITY_MAX_PROMPTS) -> StudyDay:
    """Build a small deterministic study for the exhaustive-quality comparison.

    The generator picks 1 to 3 participants and 1 to 3 activities, keeps their product (plus one
    possible second occurrence) below ``max_total_prompts`` so exhaustive search stays fast, and
    uses narrow windows of 60 to 90 minutes.
    """
    rng = random.Random(seed)
    participant_count = rng.randint(1, 3)
    activity_count = rng.randint(1, 3)
    while participant_count * activity_count > max_total_prompts and activity_count > 1:
        activity_count -= 1
    total = participant_count * activity_count
    add_second_occurrence = total + 1 <= max_total_prompts and rng.random() < 0.4

    activities: list[Activity] = []
    for index in range(activity_count):
        start_hour = rng.choice((8, 9, 10))
        duration = rng.choice((60, 75, 90))
        window_start = start_hour * 60
        activities.append(
            Activity(
                id=f"activity-{index:02d}",
                prompts_per_day=2 if add_second_occurrence and index == 0 else 1,
                min_gap_minutes=rng.choice((0, 30, 45, 60)),
                window=TimeWindow(
                    minute_to_time(window_start),
                    minute_to_time(window_start + duration),
                ),
            )
        )

    participants: list[Participant] = []
    for index in range(participant_count):
        participant_id = f"participant-{index:02d}"
        if rng.random() < 0.15:
            participants.append(Participant(participant_id))
        elif rng.random() < 0.5:
            participants.append(Participant(participant_id, any_time=True))
        else:
            start = rng.randrange(8 * 4, 11 * 4) * SLOT_MINUTES
            end = min(start + rng.choice((60, 90, 120, 180)), 22 * 60)
            participants.append(
                Participant(
                    participant_id,
                    availability=(
                        AvailabilityInterval(
                            minute_to_time(start),
                            minute_to_time(end),
                            frozenset(range(1, 8)),
                        ),
                    ),
                )
            )

    yesterday: list[HistoricalPrompt] = []
    for participant in participants:
        for activity in activities:
            slots = window_slot_indexes(activity.window)
            for occurrence in range(activity.prompts_per_day):
                if slots and rng.random() < 0.4:
                    minute = slots[rng.randrange(len(slots))] * SLOT_MINUTES
                    yesterday.append(
                        HistoricalPrompt(
                            participant.id,
                            activity.id,
                            occurrence,
                            datetime.combine(
                                DEFAULT_PLAN_DATE - timedelta(days=1),
                                minute_to_time(minute),
                                tzinfo=UTC,
                            ),
                        )
                    )
    recent_parts = tuple(
        RecentDayParts(participant.id, frozenset(rng.sample(range(4), rng.randint(0, 3))))
        for participant in participants
    )
    study = StudyConfig(
        id=f"quality-{seed}",
        schedule_style=rng.choice(list(ScheduleStyle)),
        max_prompts_per_day=rng.randint(1, 3),
        max_prompts_per_slot=rng.choice((1, 1, 2, 3)),
    )
    return StudyDay(
        study=study,
        plan_date=DEFAULT_PLAN_DATE,
        activities=tuple(activities),
        participants=tuple(participants),
        history=History(yesterday=tuple(yesterday), recent_parts=recent_parts),
    )


@dataclass(frozen=True)
class _Variable:
    participant_id: str
    activity: Activity
    occurrence: int
    domain: tuple[int, ...]


def exhaustive_best(study_day: StudyDay) -> tuple[int, float]:
    """Return the true optimum ``(planned count, score)`` of a small study by exhaustive search.

    The constraints are the same as the solver's (availability, daily cap, slot cap, minimum
    gap) and the objective is the same lexicographic pair: most planned prompts first, then the
    highest :func:`score_plan`. Branches that cannot beat the incumbent are cut with a safe
    upper bound.
    """
    activities = tuple(sorted(study_day.activities, key=lambda item: item.id))
    participants = tuple(sorted(study_day.participants, key=lambda item: item.id))
    time_zone = study_day.study.time_zone
    variables: list[_Variable] = []
    for participant in participants:
        for activity in activities:
            domain = prompt_slot_indexes(participant, activity, study_day.plan_date)
            for occurrence in range(activity.prompts_per_day):
                variables.append(_Variable(participant.id, activity, occurrence, domain))

    yesterday = {
        (item.participant_id, item.activity_id, item.occurrence): minute_of_day(
            item.scheduled_at, time_zone
        )
        for item in study_day.history.yesterday
    }
    recent: dict[str, set[int]] = {}
    for item in study_day.history.recent_parts:
        recent.setdefault(item.participant_id, set()).update(item.parts)
    variety_weight, routine_weight = style_weights(study_day.study.schedule_style)
    max_gain = max(variety_weight, routine_weight) + variety_weight

    daily: Counter[str] = Counter()
    slots: Counter[int] = Counter()
    covered: dict[str, set[int]] = {participant.id: set() for participant in participants}
    assigned: list[int | None] = [None] * len(variables)
    best_count = 0
    best_score = 0.0

    def record(count: int, score: float) -> None:
        nonlocal best_count, best_score
        if (count, score) > (best_count, best_score):
            best_count, best_score = count, score

    def can_assign(variable: _Variable, slot_index: int) -> bool:
        if daily[variable.participant_id] >= study_day.study.max_prompts_per_day:
            return False
        if slots[slot_index] >= study_day.study.max_prompts_per_slot:
            return False
        for other_index, other_value in enumerate(assigned):
            if other_value is None:
                continue
            other = variables[other_index]
            if other.participant_id != variable.participant_id:
                continue
            gap = max(variable.activity.min_gap_minutes, other.activity.min_gap_minutes)
            if abs(other_value - slot_index) * SLOT_MINUTES < gap:
                return False
        return True

    def gain(variable: _Variable, slot_index: int) -> tuple[float, int | None]:
        minute = slot_index * SLOT_MINUTES
        equivalent = yesterday.get(
            (variable.participant_id, variable.activity.id, variable.occurrence)
        )
        value = 0.0
        if equivalent is not None:
            if abs(minute - equivalent) >= 60:
                value += variety_weight
            if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
                value += routine_weight
        part = part_of_slot(slot_index)
        new_part = (
            part
            if part is not None
            and part not in covered[variable.participant_id]
            and part not in recent.get(variable.participant_id, set())
            else None
        )
        if new_part is not None:
            value += variety_weight
        return value, new_part

    def search(index: int, count: int, score: float) -> None:
        record(count, score)
        remaining = len(variables) - index
        if remaining == 0:
            return
        upper_count = count + remaining
        if upper_count < best_count:
            return
        if upper_count == best_count and score + max_gain * remaining <= best_score + 1e-9:
            return
        variable = variables[index]
        for slot_index in variable.domain:
            if not can_assign(variable, slot_index):
                continue
            value, new_part = gain(variable, slot_index)
            assigned[index] = slot_index
            daily[variable.participant_id] += 1
            slots[slot_index] += 1
            if new_part is not None:
                covered[variable.participant_id].add(new_part)
            search(index + 1, count + 1, score + value)
            if new_part is not None:
                covered[variable.participant_id].discard(new_part)
            slots[slot_index] -= 1
            daily[variable.participant_id] -= 1
            assigned[index] = None
        search(index + 1, count, score)

    search(0, 0, 0.0)
    return best_count, best_score


def run_quality(config: EvaluationConfig) -> dict[str, Any]:
    """Compare the scheduler with the exhaustive optimum on small generated studies."""
    rows: list[dict[str, Any]] = []
    at_optimum_both = 0
    at_optimum_count = 0
    count_gaps: list[int] = []
    score_gaps: list[float] = []
    for index in range(config.quality_studies):
        seed = QUALITY_SEED + index
        study_day = generate_small_study(seed)
        plan = plan_day(study_day, seed=seed, node_limit=None)
        violations = validate_plan(study_day, plan)
        if violations.total:
            raise AssertionError(f"quality study {seed} has violations: {violations}")
        optimum_count, optimum_score = exhaustive_best(study_day)
        count_gap = optimum_count - plan.planned_count
        score_gap = optimum_score - plan.score
        if count_gap == 0:
            at_optimum_count += 1
        if count_gap == 0 and abs(score_gap) < 1e-9:
            at_optimum_both += 1
        count_gaps.append(count_gap)
        score_gaps.append(score_gap)
        rows.append(
            {
                "seed": seed,
                "planned": plan.planned_count,
                "optimum_planned": optimum_count,
                "score": plan.score,
                "optimum_score": optimum_score,
                "count_gap": count_gap,
                "score_gap": score_gap,
            }
        )
    return {
        "studies": len(rows),
        "at_optimum_both": at_optimum_both,
        "at_optimum_count": at_optimum_count,
        "mean_count_gap": statistics.fmean(count_gaps),
        "max_count_gap": max(count_gaps),
        "mean_score_gap": statistics.fmean(score_gaps),
        "max_score_gap": max(score_gaps),
        "rows": rows,
    }


# -- 5. Scale, robustness and ablation -------------------------------------------------------


def run_scale(config: EvaluationConfig) -> list[dict[str, Any]]:
    """Measure nodes, backtracks, time and the result at each node budget."""
    rows: list[dict[str, Any]] = []
    for size in config.scale_sizes:
        study_day = generate_study(
            config.seed, participant_count=size, activity_count=ACTIVITY_COUNT
        )
        for budget in config.scale_budgets:
            plan = plan_day(study_day, seed=config.seed, node_limit=budget)
            violations = validate_plan(study_day, plan)
            if violations.total:
                raise AssertionError(f"scale run {size}/{budget} has violations: {violations}")
            rows.append(
                {
                    "participants": size,
                    "node_limit": budget,
                    "planned": plan.planned_count,
                    "score": plan.score,
                    "nodes": plan.nodes_expanded,
                    "backtracks": plan.backtracks,
                    "finished": plan.finished,
                    "time_ms": plan.solve_ms,
                }
            )
    return rows


def run_robustness(config: EvaluationConfig) -> list[dict[str, Any]]:
    """Run several generator seeds per size and report mean and population deviation."""
    rows: list[dict[str, Any]] = []
    for size in config.load_sizes:
        runs: list[dict[str, Any]] = []
        for seed in config.robustness_seeds:
            study_day = generate_study(seed, participant_count=size, activity_count=ACTIVITY_COUNT)
            plan = plan_day(study_day, seed=seed, node_limit=ROBUSTNESS_NODE_LIMIT)
            violations = validate_plan(study_day, plan)
            if violations.total:
                raise AssertionError(f"robustness run {size}/{seed} has violations: {violations}")
            runs.append(
                {
                    "seed": seed,
                    "planned": plan.planned_count,
                    "unplanned": plan.unplanned_count,
                    "score": plan.score,
                    "nodes": plan.nodes_expanded,
                    "time_ms": plan.solve_ms,
                }
            )
        rows.append(
            {
                "participants": size,
                "seeds": list(config.robustness_seeds),
                "metrics": _mean_and_std(runs),
                "runs": runs,
            }
        )
    return rows


def _mean_and_std(runs: Sequence[dict[str, Any]]) -> dict[str, float]:
    metrics: dict[str, float] = {}
    for field in ("planned", "unplanned", "score", "nodes", "time_ms"):
        values = [float(run[field]) for run in runs]
        metrics[f"{field}_mean"] = statistics.fmean(values)
        metrics[f"{field}_std"] = statistics.pstdev(values) if len(values) > 1 else 0.0
    return metrics


def _ablation_variants() -> tuple[tuple[str, SearchOptions], ...]:
    """The five variants of ``evaluate.py`` plus branch and bound on top of all of them."""
    return tuple(VARIANT_OPTIONS) + (("+ branch and bound", SearchOptions()),)


def run_ablation(config: EvaluationConfig) -> list[dict[str, Any]]:
    """Run the six variants on the same instances and average over seeds."""
    rows: list[dict[str, Any]] = []
    variants = _ablation_variants()
    for size in config.ablation_sizes:
        studies = {
            seed: generate_study(seed, participant_count=size, activity_count=ACTIVITY_COUNT)
            for seed in config.ablation_seeds
        }
        for name, options in variants:
            runs: list[dict[str, Any]] = []
            for seed in config.ablation_seeds:
                study_day = studies[seed]
                plan = plan_day(
                    study_day,
                    seed=seed,
                    node_limit=ABLATION_NODE_LIMIT,
                    options=options,
                )
                violations = validate_plan(study_day, plan)
                if violations.total:
                    raise AssertionError(
                        f"ablation run {size}/{seed}/{name} has violations: {violations}"
                    )
                runs.append(
                    {
                        "seed": seed,
                        "planned": plan.planned_count,
                        "score": plan.score,
                        "nodes": plan.nodes_expanded,
                        "backtracks": plan.backtracks,
                        "finished": plan.finished,
                        "time_ms": plan.solve_ms,
                    }
                )
            rows.append(
                {
                    "participants": size,
                    "variant": name,
                    "runs": runs,
                    "metrics": {
                        "runs": len(runs),
                        "planned_mean": statistics.fmean(run["planned"] for run in runs),
                        "score_mean": statistics.fmean(run["score"] for run in runs),
                        "nodes_mean": statistics.fmean(run["nodes"] for run in runs),
                        "backtracks_mean": statistics.fmean(run["backtracks"] for run in runs),
                        "finished": sum(1 for run in runs if run["finished"]),
                        "time_ms_mean": statistics.fmean(run["time_ms"] for run in runs),
                    },
                }
            )
    return rows


# -- 6. Report assembly and output -----------------------------------------------------------


def run_single_day_sections(
    config: EvaluationConfig,
) -> dict[str, list[dict[str, Any]]]:
    """Run the baseline, load and fairness tables on one study per size."""
    baseline_rows: list[dict[str, Any]] = []
    load_rows: list[dict[str, Any]] = []
    fairness_rows: list[dict[str, Any]] = []
    for size in config.load_sizes:
        study_day = generate_study(
            config.seed, participant_count=size, activity_count=ACTIVITY_COUNT
        )
        scheduler_plan = plan_day(study_day, seed=config.seed)
        baseline_plan = fixed_hours_baseline(study_day)
        scheduler_violations = validate_plan(study_day, scheduler_plan)
        if scheduler_violations.total:
            raise AssertionError(
                f"scheduler plan for {size} participants has violations: {scheduler_violations}"
            )
        baseline_violations = validate_plan(study_day, baseline_plan)
        weights = entry_type_weights(study_day, config.seed)
        plans = {"scheduler": scheduler_plan, "fixed_hours": baseline_plan}
        baseline_rows.append(
            {
                "participants": size,
                "scheduler": {
                    "planned": scheduler_plan.planned_count,
                    "score": scheduler_plan.score,
                    "violations": asdict(scheduler_violations),
                },
                "fixed_hours": {
                    "planned": baseline_plan.planned_count,
                    "score": baseline_plan.score,
                    "violations": asdict(baseline_violations),
                },
            }
        )
        load_rows.append(
            {
                "participants": size,
                "scheduler": asdict(load_metrics(study_day, plans["scheduler"].planned, weights)),
                "fixed_hours": asdict(
                    load_metrics(study_day, plans["fixed_hours"].planned, weights)
                ),
            }
        )
        fairness_rows.append(
            {
                "participants": size,
                "scheduler": asdict(fairness_metrics(study_day, plans["scheduler"].planned)),
                "fixed_hours": asdict(fairness_metrics(study_day, plans["fixed_hours"].planned)),
            }
        )
    return {
        "baseline": baseline_rows,
        "load": load_rows,
        "fairness": fairness_rows,
    }


def run_coverage_sections(config: EvaluationConfig) -> list[dict[str, Any]]:
    """Run the seven-day coverage chain for both methods at every size."""
    rows: list[dict[str, Any]] = []
    for size in config.load_sizes:
        study_day = generate_study(
            config.seed, participant_count=size, activity_count=ACTIVITY_COUNT
        )
        for method in BASELINE_METHODS:
            metrics = run_coverage_chain(
                study_day,
                method=method,
                days=COVERAGE_DAYS,
                node_limit=DEFAULT_NODE_LIMIT,
            )
            rows.append({"participants": size, "method": method, **asdict(metrics)})
    return rows


def run_all(config: EvaluationConfig) -> dict[str, Any]:
    """Run every section and assemble the raw report that both output files are built from."""
    timings: dict[str, int] = {}

    def timed(name: str, run: Callable[[], Any]) -> Any:
        started = clock.monotonic()
        result = run()
        timings[name] = int((clock.monotonic() - started) * 1000)
        print(f"[evaluation] {name}: {timings[name]} ms", flush=True)
        return result

    single_day = timed("baseline_load_fairness", lambda: run_single_day_sections(config))
    coverage = timed("coverage", lambda: run_coverage_sections(config))
    quality = timed("quality", lambda: run_quality(config))
    scale = timed("scale", lambda: run_scale(config))
    robustness = timed("robustness", lambda: run_robustness(config))
    ablation = timed("ablation", lambda: run_ablation(config))
    return {
        "meta": {
            "quick": config.quick,
            "seed": config.seed,
            "activity_count": ACTIVITY_COUNT,
            "load_sizes": list(config.load_sizes),
            "coverage_days": COVERAGE_DAYS,
            "scheduler_node_budget": DEFAULT_NODE_LIMIT,
            "quality_studies": config.quality_studies,
            "quality_seed": QUALITY_SEED,
            "robustness_seeds": list(config.robustness_seeds),
            "robustness_node_budget": ROBUSTNESS_NODE_LIMIT,
            "scale_sizes": list(config.scale_sizes),
            "scale_node_budgets": list(config.scale_budgets),
            "ablation_sizes": list(config.ablation_sizes),
            "ablation_seeds": list(config.ablation_seeds),
            "ablation_node_budget": ABLATION_NODE_LIMIT,
            "timings_ms": timings,
        },
        "baseline": single_day["baseline"],
        "load": single_day["load"],
        "fairness": single_day["fairness"],
        "coverage": coverage,
        "quality": quality,
        "scale": scale,
        "robustness": robustness,
        "ablation": ablation,
    }


def render_markdown(report: dict[str, Any]) -> str:
    """Render the report as one Markdown file with a caption above every table."""
    meta = report["meta"]
    lines: list[str] = [
        "# Scheduler evaluation results",
        "",
        "Generated by `uv run python -m scheduler.evaluation_suite`. The numbers are "
        "deterministic for the same command; only the columns marked machine-dependent "
        "(wall-clock times) change between runs and machines.",
        "",
        "Scheduler plans use the default `SearchOptions`; the node budget is per study.",
        "",
    ]
    sizes = _join_numbers(meta["load_sizes"])

    baseline_rows = []
    for row in report["baseline"]:
        for method, label in (("scheduler", "scheduler"), ("fixed_hours", "fixed hours")):
            data = row[method]
            counts = data["violations"]
            baseline_rows.append(
                (
                    row["participants"],
                    label,
                    data["planned"],
                    _number(data["score"]),
                    counts["outside_availability"],
                    counts["daily_cap"],
                    counts["slot_cap"],
                    counts["min_gap"],
                )
            )
    lines += _section(
        "1. Baseline",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}. The fixed-hours "
        "baseline ignores the slot cap and the minimum gap on purpose; its violation columns "
        "show why. The scheduler columns are checked with the module validator and are zero.",
        (
            "Participants",
            "Method",
            "Planned",
            "Score",
            "Outside availability",
            "Daily cap",
            "Slot cap",
            "Min gap",
        ),
        baseline_rows,
    )

    load_rows = []
    for row in report["load"]:
        for method, label in (("scheduler", "scheduler"), ("fixed_hours", "fixed hours")):
            data = row[method]
            load_rows.append(
                (
                    row["participants"],
                    label,
                    data["planned"],
                    data["peak_prompts_per_slot"],
                    data["weighted_peak_per_slot"],
                    _number(data["weighted_variance_08_22"]),
                    data["slots_over_cap"],
                )
            )
    lines += _section(
        "2. Load",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}. Entry types are "
        "a deterministic stand-in assigned per activity from the seed (video 5, photo 2, audio "
        "2, text 1) until `Activity` stores a real entry type. The variance is the population "
        "variance over the 56 slots of 08:00-22:00, empty slots included.",
        (
            "Participants",
            "Method",
            "Planned",
            "Peak prompts per slot",
            "Weighted peak per slot",
            "Weighted variance 08:00-22:00",
            "Slots over cap",
        ),
        load_rows,
    )

    fairness_rows = []
    for row in report["fairness"]:
        for method, label in (("scheduler", "scheduler"), ("fixed_hours", "fixed hours")):
            data = row[method]
            fairness_rows.append(
                (
                    row["participants"],
                    label,
                    data["planned_min"],
                    _number(data["planned_mean"]),
                    data["planned_max"],
                    _number(data["planned_std"]),
                    _number(data["gini"], 3),
                    _number(data["ratio_min"], 3),
                    _number(data["ratio_mean"], 3),
                )
            )
    lines += _section(
        "3. Fairness",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}. The distribution "
        "covers every participant, including those with zero planned prompts; std is the "
        "population standard deviation. Planned/requested compares the plan with the sum of "
        "`prompts_per_day` over the activities.",
        (
            "Participants",
            "Method",
            "Min",
            "Mean",
            "Max",
            "Std (population)",
            "Gini",
            "Planned/requested min",
            "Planned/requested mean",
        ),
        fairness_rows,
    )

    coverage_rows = [
        (
            row["participants"],
            "scheduler" if row["method"] == "scheduler" else "fixed hours",
            _number(row["parts_mean"]),
            row["parts_min"],
            _number(row["share_all_allowed"], 3),
            _number(row["mean_daily_score"]),
        )
        for row in report["coverage"]
    ]
    lines += _section(
        "4. Coverage",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}, "
        f"{meta['coverage_days']} consecutive days from {DEFAULT_PLAN_DATE.isoformat()}. Each "
        "method's `History` comes from its own previous days (yesterday's prompts and the parts "
        "of the day covered in the last three days). The share is over participants whose "
        "availability allows at least one part of the day.",
        (
            "Participants",
            "Method",
            "Distinct parts mean",
            "Distinct parts min",
            "Share covering all allowed",
            "Mean daily score",
        ),
        coverage_rows,
    )

    quality = report["quality"]
    quality_row = (
        quality["studies"],
        quality["at_optimum_both"],
        quality["at_optimum_count"],
        _number(quality["mean_count_gap"]),
        quality["max_count_gap"],
        _number(quality["mean_score_gap"]),
        _number(quality["max_score_gap"]),
    )
    lines += _section(
        "5. Quality",
        f"quality seeds {meta['quality_seed']}-"
        f"{meta['quality_seed'] + quality['studies'] - 1}, {quality['studies']} small generated "
        "studies (1-3 participants, 1-3 activities, narrow windows), scheduler node budget: "
        "none (`node_limit=None`). The scheduler uses the default options and is compared with "
        "the module's exhaustive search; the objective is the maximum planned count, then the "
        "maximum score.",
        (
            "Studies",
            "At optimum (count and score)",
            "At optimum count",
            "Mean count gap",
            "Max count gap",
            "Mean score gap",
            "Max score gap",
        ),
        (quality_row,),
    )

    scale_rows = [
        (
            row["participants"],
            row["node_limit"],
            row["planned"],
            _number(row["score"]),
            row["nodes"],
            row["backtracks"],
            "yes" if row["finished"] else "no",
            f"{row['time_ms']} (machine-dependent)",
        )
        for row in report["scale"]
    ]
    slowest = max(
        (row for row in report["scale"] if row["node_limit"] == max(meta["scale_node_budgets"])),
        key=lambda row: row["participants"],
        default=None,
    )
    slowest_note = (
        f" The {slowest['node_limit']}-node run at {slowest['participants']} participants took "
        f"{slowest['time_ms']} ms in this run."
        if slowest is not None
        else ""
    )
    lines += _section(
        "6. Scale",
        f"seed {meta['seed']}, sizes {_join_numbers(meta['scale_sizes'])} participants, "
        f"{meta['activity_count']} activities, scheduler node budgets "
        f"{_join_numbers(meta['scale_node_budgets'])}, default options. Time ms is "
        f"machine-dependent.{slowest_note}",
        (
            "Participants",
            "Node budget",
            "Planned",
            "Score",
            "Nodes",
            "Backtracks",
            "Finished",
            "Time ms (machine-dependent)",
        ),
        scale_rows,
    )

    robustness_rows = [
        (
            row["participants"],
            len(row["seeds"]),
            _number(row["metrics"]["planned_mean"]),
            _number(row["metrics"]["planned_std"]),
            _number(row["metrics"]["unplanned_mean"]),
            _number(row["metrics"]["unplanned_std"]),
            _number(row["metrics"]["score_mean"]),
            _number(row["metrics"]["score_std"]),
            _number(row["metrics"]["nodes_mean"]),
            _number(row["metrics"]["nodes_std"]),
            f"{_number(row['metrics']['time_ms_mean'])} (machine-dependent)",
            f"{_number(row['metrics']['time_ms_std'])} (machine-dependent)",
        )
        for row in report["robustness"]
    ]
    lines += _section(
        "7. Robustness",
        f"seeds {_join_numbers(meta['robustness_seeds'])}, sizes {sizes} participants, "
        f"{meta['activity_count']} activities, scheduler node budget "
        f"{meta['robustness_node_budget']}, default options. Mean and population standard "
        "deviation over the seeds; time ms is machine-dependent.",
        (
            "Participants",
            "Seeds",
            "Planned mean",
            "Planned std",
            "Unplanned mean",
            "Unplanned std",
            "Score mean",
            "Score std",
            "Nodes mean",
            "Nodes std",
            "Time ms mean (machine-dependent)",
            "Time ms std (machine-dependent)",
        ),
        robustness_rows,
    )

    ablation_rows = [
        (
            row["participants"],
            row["variant"],
            row["metrics"]["runs"],
            _number(row["metrics"]["planned_mean"]),
            _number(row["metrics"]["score_mean"]),
            _number(row["metrics"]["nodes_mean"]),
            _number(row["metrics"]["backtracks_mean"]),
            row["metrics"]["finished"],
            f"{_number(row['metrics']['time_ms_mean'])} (machine-dependent)",
        )
        for row in report["ablation"]
    ]
    lines += _section(
        "8. Ablation",
        f"seeds {_join_numbers(meta['ablation_seeds'])}, sizes "
        f"{_join_numbers(meta['ablation_sizes'])} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['ablation_node_budget']}. The first five "
        "variants match `evaluate.py`; the last one turns on branch and bound on top of AC-3. "
        "Means over the seeds; time ms is machine-dependent.",
        (
            "Participants",
            "Variant",
            "Runs",
            "Planned mean",
            "Score mean",
            "Nodes mean",
            "Backtracks mean",
            "Finished",
            "Time ms mean (machine-dependent)",
        ),
        ablation_rows,
    )
    return "\n".join(lines) + "\n"


def _section(
    title: str,
    caption: str,
    headers: Sequence[str],
    rows: Sequence[Sequence[object]],
) -> list[str]:
    return [f"## {title}", "", f"*Caption: {caption}*", "", _markdown_table(headers, rows), ""]


def _markdown_table(headers: Sequence[str], rows: Sequence[Sequence[object]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    lines.extend("| " + " | ".join(str(cell) for cell in row) + " |" for row in rows)
    return "\n".join(lines)


def _number(value: float, digits: int = 2) -> str:
    return f"{value:.{digits}f}"


def _join_numbers(values: Sequence[int]) -> str:
    return "/".join(str(value) for value in values)


def _prompt_sort_key(prompt: PlannedPrompt) -> tuple[str, str, int]:
    return prompt.participant_id, prompt.activity_id, prompt.occurrence


def _unplanned_sort_key(prompt: UnplannedPrompt) -> tuple[str, str, int]:
    return prompt.participant_id, prompt.activity_id, prompt.occurrence


def write_outputs(report: dict[str, Any], out_dir: Path) -> tuple[Path, Path]:
    """Write ``results.md`` and ``results.json`` and return both paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = out_dir / "results.md"
    json_path = out_dir / "results.json"
    markdown_path.write_text(render_markdown(report), encoding="utf-8")
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return markdown_path, json_path


def main(argv: Sequence[str] | None = None) -> None:
    """Parse the command line, run the evaluation and write both output files."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quick",
        action="store_true",
        help="smaller sizes and fewer studies; skips the 1000000-node scale run",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("evaluation"),
        help="output directory for results.md and results.json (default: evaluation)",
    )
    args = parser.parse_args(argv)
    config = EvaluationConfig(quick=args.quick)
    report = run_all(config)
    markdown_path, json_path = write_outputs(report, args.out)
    print(f"wrote {markdown_path}")
    print(f"wrote {json_path}")


if __name__ == "__main__":
    main()


__all__ = [
    "EvaluationConfig",
    "count_violations",
    "entry_type_weights",
    "exhaustive_best",
    "fixed_hours_baseline",
    "generate_small_study",
    "main",
    "render_markdown",
    "run_all",
    "run_coverage_chain",
    "validate_plan",
    "write_outputs",
]
