"""Full reproducible evaluation of the Fieldnote CSP scheduler (scheduler.md:143-181).

Run from ``services/scheduler``::

    uv run python -m scheduler.evaluation_suite [--quick] [--out DIR]

The full run writes ``results.md`` (the tables for the final report) and ``results.json`` (the
raw numbers) to ``evaluation/``. Every number is deterministic for the same command except
wall-clock times: ``timings_ms`` in the JSON and the columns marked as machine-dependent. Those
change between machines and runs.
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
QUALITY_MIN_PROMPTS = 6
QUALITY_MAX_PROMPTS = 12
SINGLE_DAY_NODE_LIMIT = 20_000
ROBUSTNESS_NODE_LIMIT = 20_000
ABLATION_NODE_LIMIT = 20_000
SCALE_BUDGETS = (1_000, 10_000, 100_000, 1_000_000)
QUICK_SCALE_BUDGETS = (1_000, 10_000, 100_000)
SHARED_CAPACITY = 40
SHARED_CAPACITY_SEEDS = (2026, 2027)
SHARED_CAPACITY_PARTICIPANTS = 50

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
            assert minute_of_day(local, time_zone) % SLOT_MINUTES == 0, (
                "a planned prompt is not aligned to a 15-minute slot"
            )
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


@dataclass(frozen=True)
class LoadMetrics:
    """How the prompts of one plan spread over the day."""

    planned: int
    peak_prompts_per_slot: int
    weighted_peak_per_slot: int
    weighted_variance_08_22: float
    slots_over_cap: int
    slots_over_weighted_capacity: int


def _weighted_load_by_slot(study_day: StudyDay, planned: Iterable[PlannedPrompt]) -> dict[int, int]:
    """The weighted load of ``planned`` per slot, using ``Activity.weight``."""
    time_zone = study_day.study.time_zone
    weights = {activity.id: activity.weight for activity in study_day.activities}
    weighted: Counter[int] = Counter()
    for prompt in planned:
        slot_index = minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES
        weighted[slot_index] += weights[prompt.activity_id]
    return dict(weighted)


def load_metrics(study_day: StudyDay, planned: Sequence[PlannedPrompt]) -> LoadMetrics:
    """Compute the load measures of one plan.

    The weighted peak is the heaviest weighted slot over the whole day. The weighted variance is
    the population variance over the 56 15-minute slots of 08:00-22:00, with empty slots
    included. The prompt peak and the number of slots over the count cap look at the whole day.
    """
    time_zone = study_day.study.time_zone
    first_slot = DAY_PART_START // SLOT_MINUTES
    last_slot = DAY_PART_END // SLOT_MINUTES
    counts: Counter[int] = Counter()
    for prompt in planned:
        slot_index = minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES
        counts[slot_index] += 1
    weighted = _weighted_load_by_slot(study_day, planned)
    loads = [0] * (last_slot - first_slot)
    for slot_index, load in weighted.items():
        if first_slot <= slot_index < last_slot:
            loads[slot_index - first_slot] += load
    slot_capacity = study_day.study.slot_capacity
    return LoadMetrics(
        planned=len(planned),
        peak_prompts_per_slot=max(counts.values(), default=0),
        weighted_peak_per_slot=max(weighted.values(), default=0),
        weighted_variance_08_22=statistics.pvariance(loads),
        slots_over_cap=sum(
            1 for count in counts.values() if count > study_day.study.max_prompts_per_slot
        ),
        slots_over_weighted_capacity=sum(
            1 for load in weighted.values() if slot_capacity is not None and load > slot_capacity
        ),
    )


@dataclass(frozen=True)
class FairnessMetrics:
    """Distribution of the planned prompts over the participants.

    The main distribution covers the eligible participants, those with at least one allowed slot
    on the plan date. The ``full_*`` fields repeat the measures over every participant, so the
    excluded participants are still visible.
    """

    requested: int
    eligible_participants: int
    excluded_participants: int
    planned_min: int
    planned_mean: float
    planned_max: int
    planned_std: float
    gini: float
    ratio_min: float
    ratio_mean: float
    full_planned_min: int
    full_planned_mean: float
    full_planned_max: int
    full_planned_std: float
    full_gini: float
    full_ratio_min: float
    full_ratio_mean: float
    planned_per_participant: tuple[int, ...]
    requested_per_participant: tuple[int, ...]


def _requested_per_participant(study_day: StudyDay) -> dict[str, int]:
    """Prompts whose domain (window and availability) is non-empty before the search."""
    requested: dict[str, int] = {}
    for participant in study_day.participants:
        count = 0
        for activity in study_day.activities:
            if prompt_slot_indexes(participant, activity, study_day.plan_date):
                count += activity.prompts_per_day
        requested[participant.id] = count
    return requested


def fairness_metrics(study_day: StudyDay, planned: Sequence[PlannedPrompt]) -> FairnessMetrics:
    """Compute the distribution of planned prompts per participant.

    The main distribution covers the participants with at least one allowed slot on the plan
    date; the others are reported in ``excluded_participants``. ``requested`` counts only prompts
    whose domain (window and availability) is non-empty before the search. The
    ``planned/requested`` ratio is per participant. Standard deviations and the Gini coefficient
    use the whole population.
    """
    participants = tuple(sorted(study_day.participants, key=lambda item: item.id))
    counts = {participant.id: 0 for participant in participants}
    for prompt in planned:
        counts[prompt.participant_id] += 1
    requested_by_participant = _requested_per_participant(study_day)

    eligible = [
        participant for participant in participants if requested_by_participant[participant.id] > 0
    ]
    values = [counts[participant.id] for participant in eligible]
    ratios = [
        counts[participant.id] / requested_by_participant[participant.id]
        for participant in eligible
    ]

    full_values = [counts[participant.id] for participant in participants]
    full_ratios = [
        counts[participant.id] / requested_by_participant[participant.id]
        if requested_by_participant[participant.id]
        else 1.0
        for participant in participants
    ]
    return FairnessMetrics(
        requested=sum(requested_by_participant.values()),
        eligible_participants=len(eligible),
        excluded_participants=len(participants) - len(eligible),
        planned_min=min(values, default=0),
        planned_mean=statistics.fmean(values) if values else 0.0,
        planned_max=max(values, default=0),
        planned_std=statistics.pstdev(values) if len(values) > 1 else 0.0,
        gini=_gini(values),
        ratio_min=min(ratios, default=0.0),
        ratio_mean=statistics.fmean(ratios) if ratios else 0.0,
        full_planned_min=min(full_values, default=0),
        full_planned_mean=statistics.fmean(full_values) if full_values else 0.0,
        full_planned_max=max(full_values, default=0),
        full_planned_std=statistics.pstdev(full_values) if len(full_values) > 1 else 0.0,
        full_gini=_gini(full_values),
        full_ratio_min=min(full_ratios, default=0.0),
        full_ratio_mean=statistics.fmean(full_ratios) if full_ratios else 0.0,
        planned_per_participant=tuple(full_values),
        requested_per_participant=tuple(
            requested_by_participant[participant.id] for participant in participants
        ),
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
    runs_finished: int
    runs: int
    parts_per_participant: tuple[int, ...]
    allowed_parts_per_participant: tuple[int, ...]
    daily_scores: tuple[float, ...]


def run_coverage_chain(
    study_day: StudyDay, *, method: str, days: int, node_limit: int
) -> CoverageMetrics:
    """Plan ``days`` consecutive days, feeding each day the history of that method's own plans.

    ``method`` is ``"scheduler"`` or ``"fixed_hours"``. The first day is seeded from
    ``study_day.history`` (yesterday's prompts and the recent parts), for both methods. On the
    following days yesterday's prompts and the parts of the day covered in the last three days
    come from the plans of the same method, so each policy is evaluated as a chain rather than
    against a mixed history.
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
    for item in study_day.history.recent_parts:
        if item.participant_id in recent:
            recent[item.participant_id].append(item.parts)
    covered: dict[str, set[int]] = {participant_id: set() for participant_id in participant_ids}
    allowed: dict[str, set[int]] = {participant_id: set() for participant_id in participant_ids}
    scores: list[float] = []
    finished_runs = 0
    previous_planned: tuple[PlannedPrompt, ...] = ()
    for offset in range(days):
        plan_date = DEFAULT_PLAN_DATE + timedelta(days=offset)
        if offset == 0:
            history = study_day.history
        else:
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
        if plan.finished:
            finished_runs += 1
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
        runs_finished=finished_runs,
        runs=days,
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


_ENTRY_TYPE_POOL = ("video", "photo", "audio", "text", "scale", "choice")
_HEAVY_ENTRY_TYPES = ("video", "photo", "audio")


def _small_study_shape(
    rng: random.Random, min_total_prompts: int, max_total_prompts: int
) -> tuple[int, int, int]:
    """Choose ``(participants, activities, activities with two prompts)`` inside the bounds.

    A second occurrence costs one prompt per participant, so the total is
    ``participants * (activities + second_occurrences)``.
    """
    candidates = [
        (participants, activities, seconds)
        for participants in range(2, 6)
        for activities in range(2, 4)
        for seconds in range(activities + 1)
        if min_total_prompts <= participants * (activities + seconds) <= max_total_prompts
    ]
    if not candidates:
        return 2, 2, 0
    return rng.choice(candidates)


def generate_small_study(
    seed: int,
    *,
    min_total_prompts: int = QUALITY_MIN_PROMPTS,
    max_total_prompts: int = QUALITY_MAX_PROMPTS,
    slot_capacity: int | None = None,
) -> StudyDay:
    """Build a deterministic study for the exhaustive-quality comparison.

    The study has 2-5 participants, 2-3 activities and 6-12 prompts by default. Windows are
    narrow (30-120 minutes) and overlap, so slots are scarce, and the minimum gaps vary. At least
    the first participant is available at any time, so a prompt is always plannable.
    ``run_quality`` then tightens the daily and slot caps to the unconstrained plan's maxima so
    they bind. Activities have distinct entry types, including at least one heavy type, so
    ``Activity.weight`` varies. ``slot_capacity`` is passed through to the study config.

    ``max_total_prompts`` bounds the number of prompts. A second occurrence is per participant,
    so it adds ``participant_count`` prompts, not one; the bound is asserted.
    """
    if min_total_prompts < 1 or max_total_prompts < min_total_prompts:
        raise ValueError("prompt bounds must satisfy 1 <= min <= max")
    rng = random.Random(seed)
    participant_count, activity_count, second_count = _small_study_shape(
        rng, min_total_prompts, max_total_prompts
    )
    total_prompts = participant_count * (activity_count + second_count)
    assert min_total_prompts <= total_prompts <= max_total_prompts, (
        f"generated {total_prompts} prompts outside {min_total_prompts}..{max_total_prompts}"
    )

    center = rng.choice((9 * 60, 10 * 60, 11 * 60))
    second_activities = set(rng.sample(range(activity_count), second_count))
    entry_types = [rng.choice(_HEAVY_ENTRY_TYPES)]
    entry_types += rng.sample(
        [item for item in _ENTRY_TYPE_POOL if item != entry_types[0]], activity_count - 1
    )
    activities: list[Activity] = []
    for index in range(activity_count):
        start = max(7 * 60, center - rng.choice((0, 15, 30)))
        end = min(start + rng.choice((30, 45, 60, 90, 120)), 22 * 60)
        activities.append(
            Activity(
                id=f"activity-{index:02d}",
                prompts_per_day=2 if index in second_activities else 1,
                min_gap_minutes=rng.choice((0, 15, 30, 45, 60, 90)),
                window=TimeWindow(minute_to_time(start), minute_to_time(end)),
                entry_types=(entry_types[index],),
            )
        )

    participants: list[Participant] = []
    for index in range(participant_count):
        participant_id = f"participant-{index:02d}"
        roll = rng.random()
        if index == 0 or roll < 0.60:
            # The first participant is always available, so every study has a plannable prompt.
            participants.append(Participant(participant_id, any_time=True))
        elif roll < 0.70:
            participants.append(Participant(participant_id))
        else:
            start = max(7 * 60, center - rng.choice((15, 30, 60)))
            end = min(center + rng.choice((0, 30, 60, 90)), 22 * 60)
            if end <= start:
                end = min(start + 30, 22 * 60)
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

    prompts_per_participant = activity_count + second_count
    daily_cap = max(1, prompts_per_participant - rng.randint(1, prompts_per_participant // 2 + 1))
    study = StudyConfig(
        id=f"quality-{seed}",
        schedule_style=rng.choice(list(ScheduleStyle)),
        max_prompts_per_day=daily_cap,
        max_prompts_per_slot=rng.choice((1, 2, 2, 3)),
        slot_capacity=slot_capacity,
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

    @property
    def weight(self) -> int:
        return self.activity.weight


def exhaustive_best(study_day: StudyDay) -> tuple[int, float]:
    """Return the true optimum ``(planned count, score)`` of a small study by exhaustive search.

    The search is exact: every variable either takes a feasible slot or is left unplanned, and no
    solution is skipped. It honours availability, the daily cap, the slot count cap, the minimum
    gap and ``StudyConfig.slot_capacity`` (weighted load per slot). The objective is the same
    lexicographic pair as the solver: most planned prompts first, then the highest
    :func:`score_plan`. Branches are pruned only with safe upper bounds: the remaining prompts
    capped by the daily cap, and the best score each remaining prompt can add plus one variety
    point per reachable uncovered part of the day. There is no node budget.
    """
    activities = tuple(sorted(study_day.activities, key=lambda item: item.id))
    participants = tuple(sorted(study_day.participants, key=lambda item: item.id))
    time_zone = study_day.study.time_zone
    max_daily = study_day.study.max_prompts_per_day
    max_slot = study_day.study.max_prompts_per_slot
    slot_capacity = study_day.study.slot_capacity

    variables: list[_Variable] = []
    for participant in participants:
        for activity in activities:
            domain = prompt_slot_indexes(participant, activity, study_day.plan_date)
            if not domain:
                # An empty domain can never be planned, so dropping it keeps the optimum.
                continue
            for occurrence in range(activity.prompts_per_day):
                variables.append(_Variable(participant.id, activity, occurrence, domain))
    variables.sort(
        key=lambda variable: (
            len(variable.domain),
            variable.participant_id,
            variable.activity.id,
            variable.occurrence,
        )
    )

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

    daily: Counter[str] = Counter()
    slots: Counter[int] = Counter()
    weighted: Counter[int] = Counter()
    covered: dict[str, set[int]] = {participant.id: set() for participant in participants}
    assigned: list[int | None] = [None] * len(variables)
    best_count = 0
    best_score = 0.0

    def record(count: int, score: float) -> None:
        nonlocal best_count, best_score
        if (count, score) > (best_count, best_score):
            best_count, best_score = count, score

    def can_assign(variable: _Variable, slot_index: int) -> bool:
        participant_id = variable.participant_id
        if daily[participant_id] >= max_daily:
            return False
        if slots[slot_index] >= max_slot:
            return False
        if slot_capacity is not None and weighted[slot_index] + variable.weight > slot_capacity:
            return False
        for other_index, other_value in enumerate(assigned):
            if other_value is None:
                continue
            other = variables[other_index]
            if other.participant_id != participant_id:
                continue
            gap = max(variable.activity.min_gap_minutes, other.activity.min_gap_minutes)
            if abs(other_value - slot_index) * SLOT_MINUTES < gap:
                return False
        return True

    def prompt_gain(variable: _Variable, slot_index: int) -> float:
        equivalent = yesterday.get(
            (variable.participant_id, variable.activity.id, variable.occurrence)
        )
        if equivalent is None:
            return 0.0
        minute = slot_index * SLOT_MINUTES
        value = 0.0
        if abs(minute - equivalent) >= 60:
            value += variety_weight
        if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
            value += routine_weight
        return value

    def gain(variable: _Variable, slot_index: int) -> tuple[float, int | None]:
        value = prompt_gain(variable, slot_index)
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

    def count_upper_bound(index: int) -> int:
        """Remaining prompts capped by each participant's remaining daily allowance."""
        remaining: Counter[str] = Counter()
        for variable in variables[index:]:
            remaining[variable.participant_id] += 1
        return sum(
            min(count, max(0, max_daily - daily[participant_id]))
            for participant_id, count in remaining.items()
        )

    def score_upper_bound(index: int) -> float:
        """Best score the remaining prompts can add, ignoring their interactions."""
        bound = 0.0
        uncovered_parts: set[tuple[str, int]] = set()
        for variable in variables[index:]:
            equivalent = yesterday.get(
                (variable.participant_id, variable.activity.id, variable.occurrence)
            )
            best_prompt = 0.0
            for slot_index in variable.domain:
                minute = slot_index * SLOT_MINUTES
                value = 0.0
                if equivalent is not None:
                    if abs(minute - equivalent) >= 60:
                        value += variety_weight
                    if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
                        value += routine_weight
                if value > best_prompt:
                    best_prompt = value
                part = part_of_slot(slot_index)
                if (
                    part is not None
                    and part not in covered.get(variable.participant_id, set())
                    and part not in recent.get(variable.participant_id, set())
                ):
                    uncovered_parts.add((variable.participant_id, part))
            bound += best_prompt
        return bound + variety_weight * len(uncovered_parts)

    def search(index: int, count: int, score: float) -> None:
        record(count, score)
        if index == len(variables):
            return
        upper_count = count + count_upper_bound(index)
        if upper_count < best_count:
            return
        if upper_count == best_count and score + score_upper_bound(index) <= best_score + 1e-9:
            return
        variable = variables[index]
        feasible = [slot for slot in variable.domain if can_assign(variable, slot)]
        feasible.sort(key=lambda slot: (-prompt_gain(variable, slot), slot))
        for slot_index in feasible:
            value, new_part = gain(variable, slot_index)
            assigned[index] = slot_index
            daily[variable.participant_id] += 1
            slots[slot_index] += 1
            weighted[slot_index] += variable.weight
            if new_part is not None:
                covered[variable.participant_id].add(new_part)
            search(index + 1, count + 1, score + value)
            if new_part is not None:
                covered[variable.participant_id].discard(new_part)
            weighted[slot_index] -= variable.weight
            slots[slot_index] -= 1
            daily[variable.participant_id] -= 1
            assigned[index] = None
        search(index + 1, count, score)

    search(0, 0, 0.0)
    return best_count, best_score


def run_quality(config: EvaluationConfig) -> dict[str, Any]:
    """Compare the scheduler with the exhaustive optimum on larger small studies.

    Once the unconstrained plan exists, its per-participant and per-slot maxima replace the
    generated daily and slot caps, so both caps bind (the plan reaches them) without losing the
    plan. Half of the studies get a ``slot_capacity`` equal to half of the weighted peak of that
    plan (rounded up), so the capacity binds too. The scheduler runs with no node budget, so
    every run must finish; the exhaustive oracle is exact.
    """
    rows: list[dict[str, Any]] = []
    at_optimum_both = 0
    at_optimum_count = 0
    count_gaps: list[int] = []
    score_gaps: list[float] = []
    prompt_counts: list[int] = []
    capacity_studies = 0
    binding_capacity_studies = 0
    for index in range(config.quality_studies):
        seed = QUALITY_SEED + index
        study_day = generate_small_study(seed)
        prompt_count = len(study_day.participants) * sum(
            activity.prompts_per_day for activity in study_day.activities
        )
        prompt_counts.append(prompt_count)

        plan = plan_day(study_day, seed=seed, node_limit=None)
        assert plan.finished, f"quality study {seed} was cut with no node budget"
        violations = validate_plan(study_day, plan)
        if violations.total:
            raise AssertionError(f"quality study {seed} has violations: {violations}")

        # Make the two count caps bite: tighten each to the largest value the unconstrained
        # optimal plan uses, so that plan reaches both caps and stays feasible and optimal.
        per_slot = Counter(
            minute_of_day(prompt.scheduled_at, study_day.study.time_zone) // SLOT_MINUTES
            for prompt in plan.planned
        )
        per_participant = Counter(prompt.participant_id for prompt in plan.planned)
        used_daily = max(per_participant.values(), default=0)
        used_slot = max(per_slot.values(), default=0)
        assert used_daily and used_slot, f"quality study {seed} planned nothing"
        study_day = replace(
            study_day,
            study=replace(
                study_day.study,
                max_prompts_per_day=used_daily,
                max_prompts_per_slot=used_slot,
            ),
        )
        violations = validate_plan(study_day, plan)
        if violations.total:
            raise AssertionError(
                f"quality study {seed} has violations after tightening: {violations}"
            )

        capacity: int | None = None
        if index % 2 == 1:
            peak = load_metrics(study_day, plan.planned).weighted_peak_per_slot
            heaviest = max(activity.weight for activity in study_day.activities)
            capacity = max(1, (peak + 1) // 2)
            if capacity >= peak and capacity >= heaviest:
                # The unconstrained plan was all light prompts; make the capacity bite on the
                # heaviest activity instead of leaving every prompt feasible.
                capacity = max(1, heaviest - 1)
            if capacity < peak or capacity < heaviest:
                binding_capacity_studies += 1
            study_day = replace(study_day, study=replace(study_day.study, slot_capacity=capacity))
            plan = plan_day(study_day, seed=seed, node_limit=None)
            assert plan.finished, f"quality study {seed} was cut with no node budget"
            violations = validate_plan(study_day, plan)
            if violations.total:
                raise AssertionError(f"quality study {seed} has violations: {violations}")
            planned_load = max(_weighted_load_by_slot(study_day, plan.planned).values(), default=0)
            assert planned_load <= capacity, (
                f"quality study {seed} exceeds its slot capacity: {planned_load} > {capacity}"
            )
            capacity_studies += 1

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
                "prompt_count": prompt_count,
                "slot_capacity": capacity,
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
        "prompt_count_min": min(prompt_counts),
        "prompt_count_mean": statistics.fmean(prompt_counts),
        "prompt_count_max": max(prompt_counts),
        "capacity_studies": capacity_studies,
        "binding_capacity_studies": binding_capacity_studies,
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
                    "finished": plan.finished,
                    "time_ms": plan.solve_ms,
                }
            )
        metrics = _mean_and_std(runs)
        metrics["runs"] = len(runs)
        metrics["finished"] = sum(1 for run in runs if run["finished"])
        rows.append(
            {
                "participants": size,
                "seeds": list(config.robustness_seeds),
                "metrics": metrics,
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


def _slot_cap_unplanned(plan: DayPlan) -> int:
    """Prompts left unplanned because every remaining slot was over the weighted capacity."""
    return sum(1 for prompt in plan.unplanned if prompt.reason is UnplannedReason.SLOT_CAP)


def run_single_day_sections(
    config: EvaluationConfig,
) -> dict[str, list[dict[str, Any]]]:
    """Run the baseline, load (with capacity) and fairness tables on one study per size."""
    baseline_rows: list[dict[str, Any]] = []
    load_rows: list[dict[str, Any]] = []
    fairness_rows: list[dict[str, Any]] = []
    for size in config.load_sizes:
        study_day = generate_study(
            config.seed, participant_count=size, activity_count=ACTIVITY_COUNT
        )
        scheduler_plan = plan_day(study_day, seed=config.seed, node_limit=SINGLE_DAY_NODE_LIMIT)
        baseline_plan = fixed_hours_baseline(study_day)
        scheduler_violations = validate_plan(study_day, scheduler_plan)
        if scheduler_violations.total:
            raise AssertionError(
                f"scheduler plan for {size} participants has violations: {scheduler_violations}"
            )
        baseline_violations = validate_plan(study_day, baseline_plan)

        unconstrained_load = load_metrics(study_day, scheduler_plan.planned)
        capacity = max(1, (unconstrained_load.weighted_peak_per_slot + 1) // 2)
        capacity_study = replace(study_day, study=replace(study_day.study, slot_capacity=capacity))
        capacity_plan = plan_day(capacity_study, seed=config.seed, node_limit=SINGLE_DAY_NODE_LIMIT)
        capacity_violations = validate_plan(capacity_study, capacity_plan)
        if capacity_violations.total:
            raise AssertionError(
                f"capacity plan for {size} participants has violations: {capacity_violations}"
            )
        capacity_load = load_metrics(capacity_study, capacity_plan.planned)
        assert capacity_load.weighted_peak_per_slot <= capacity, (
            f"capacity plan for {size} participants exceeds {capacity}"
        )
        assert capacity_load.slots_over_weighted_capacity == 0

        plans = {
            "scheduler": scheduler_plan,
            "scheduler_capacity": capacity_plan,
            "fixed_hours": baseline_plan,
        }
        baseline_rows.append(
            {
                "participants": size,
                "scheduler": {
                    "planned": scheduler_plan.planned_count,
                    "score": scheduler_plan.score,
                    "finished": scheduler_plan.finished,
                    "violations": asdict(scheduler_violations),
                },
                "fixed_hours": {
                    "planned": baseline_plan.planned_count,
                    "score": baseline_plan.score,
                    "finished": baseline_plan.finished,
                    "violations": asdict(baseline_violations),
                },
            }
        )
        load_rows.append(
            {
                "participants": size,
                "capacity": capacity,
                "scheduler": {
                    **asdict(load_metrics(study_day, plans["scheduler"].planned)),
                    "finished": plans["scheduler"].finished,
                    "slot_cap_unplanned": _slot_cap_unplanned(plans["scheduler"]),
                },
                "scheduler_capacity": {
                    **asdict(load_metrics(capacity_study, plans["scheduler_capacity"].planned)),
                    "finished": plans["scheduler_capacity"].finished,
                    "slot_cap_unplanned": _slot_cap_unplanned(plans["scheduler_capacity"]),
                    "prompts_lost_vs_scheduler": max(
                        0, scheduler_plan.planned_count - capacity_plan.planned_count
                    ),
                },
                "fixed_hours": {
                    **asdict(load_metrics(study_day, plans["fixed_hours"].planned)),
                    "finished": plans["fixed_hours"].finished,
                    "slot_cap_unplanned": _slot_cap_unplanned(plans["fixed_hours"]),
                },
            }
        )
        fairness_rows.append(
            {
                "participants": size,
                "scheduler": {
                    **asdict(fairness_metrics(study_day, plans["scheduler"].planned)),
                    "finished": plans["scheduler"].finished,
                },
                "fixed_hours": {
                    **asdict(fairness_metrics(study_day, plans["fixed_hours"].planned)),
                    "finished": plans["fixed_hours"].finished,
                },
            }
        )
    return {
        "baseline": baseline_rows,
        "load": load_rows,
        "fairness": fairness_rows,
    }


def run_shared_capacity(config: EvaluationConfig) -> dict[str, Any]:
    """Plan two studies that share one weighted slot capacity.

    Both studies use seeds 2026 and 2027 with 50 participants and ``slot_capacity=40``. The
    second study is planned twice: once with the weighted load of the first study passed as
    ``external_slot_load`` (coordinated), and once alone (independent). The coordinated combined
    peak must stay under the capacity; the independent one can exceed it.
    """
    del config  # the shared-capacity setup is fixed by the brief
    seed_a, seed_b = SHARED_CAPACITY_SEEDS
    study_a = generate_study(
        seed_a,
        participant_count=SHARED_CAPACITY_PARTICIPANTS,
        activity_count=ACTIVITY_COUNT,
        slot_capacity=SHARED_CAPACITY,
    )
    study_b = generate_study(
        seed_b,
        participant_count=SHARED_CAPACITY_PARTICIPANTS,
        activity_count=ACTIVITY_COUNT,
        slot_capacity=SHARED_CAPACITY,
    )
    plan_a = plan_day(study_a, seed=seed_a, node_limit=SINGLE_DAY_NODE_LIMIT)
    validate_plan(study_a, plan_a)
    load_a = _weighted_load_by_slot(study_a, plan_a.planned)

    plan_b_shared = plan_day(
        study_b,
        external_slot_load=load_a,
        seed=seed_b,
        node_limit=SINGLE_DAY_NODE_LIMIT,
    )
    validate_plan(study_b, plan_b_shared)
    load_b_shared = _weighted_load_by_slot(study_b, plan_b_shared.planned)
    combined_shared = max(
        (
            load_a.get(slot, 0) + load_b_shared.get(slot, 0)
            for slot in set(load_a) | set(load_b_shared)
        ),
        default=0,
    )
    assert combined_shared <= SHARED_CAPACITY, (
        f"coordinated studies exceed the shared capacity: {combined_shared}"
    )

    plan_b_alone = plan_day(study_b, seed=seed_b, node_limit=SINGLE_DAY_NODE_LIMIT)
    validate_plan(study_b, plan_b_alone)
    load_b_alone = _weighted_load_by_slot(study_b, plan_b_alone.planned)
    combined_independent = max(
        (
            load_a.get(slot, 0) + load_b_alone.get(slot, 0)
            for slot in set(load_a) | set(load_b_alone)
        ),
        default=0,
    )
    return {
        "capacity": SHARED_CAPACITY,
        "studies": [
            {
                "role": "first study",
                "seed": seed_a,
                "planned": plan_a.planned_count,
                "weighted_peak": max(load_a.values(), default=0),
                "finished": plan_a.finished,
            },
            {
                "role": "second study, coordinated",
                "seed": seed_b,
                "planned": plan_b_shared.planned_count,
                "weighted_peak": max(load_b_shared.values(), default=0),
                "finished": plan_b_shared.finished,
            },
        ],
        "combined_shared_peak": combined_shared,
        "independent": {
            "seed": seed_b,
            "planned": plan_b_alone.planned_count,
            "weighted_peak": max(load_b_alone.values(), default=0),
            "finished": plan_b_alone.finished,
        },
        "combined_independent_peak": combined_independent,
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
                node_limit=SINGLE_DAY_NODE_LIMIT,
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
    shared_capacity = timed("shared_capacity", lambda: run_shared_capacity(config))
    return {
        "meta": {
            "quick": config.quick,
            "seed": config.seed,
            "activity_count": ACTIVITY_COUNT,
            "load_sizes": list(config.load_sizes),
            "coverage_days": COVERAGE_DAYS,
            "single_day_node_budget": SINGLE_DAY_NODE_LIMIT,
            "scheduler_node_budget": DEFAULT_NODE_LIMIT,
            "quality_studies": config.quality_studies,
            "quality_seed": QUALITY_SEED,
            "quality_min_prompts": QUALITY_MIN_PROMPTS,
            "quality_max_prompts": QUALITY_MAX_PROMPTS,
            "robustness_seeds": list(config.robustness_seeds),
            "robustness_node_budget": ROBUSTNESS_NODE_LIMIT,
            "scale_sizes": list(config.scale_sizes),
            "scale_node_budgets": list(config.scale_budgets),
            "ablation_sizes": list(config.ablation_sizes),
            "ablation_seeds": list(config.ablation_seeds),
            "ablation_node_budget": ABLATION_NODE_LIMIT,
            "shared_capacity": SHARED_CAPACITY,
            "shared_capacity_seeds": list(SHARED_CAPACITY_SEEDS),
            "shared_capacity_participants": SHARED_CAPACITY_PARTICIPANTS,
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
        "shared_capacity": shared_capacity,
    }


def render_markdown(report: dict[str, Any]) -> str:
    """Render the report as one Markdown file with a caption above every table."""
    meta = report["meta"]
    lines: list[str] = [
        "# Scheduler evaluation results",
        "",
        "Generated by `uv run python -m scheduler.evaluation_suite`. Every number is "
        "deterministic for the same command except wall-clock times: `timings_ms` in "
        "`results.json` and every column marked machine-dependent. Those change between runs "
        "and machines.",
        "",
        "Scheduler plans use the default `SearchOptions`; the node budget is per study. A run "
        "with `Finished = no` was cut by its node budget: it reports the best plan found, not a "
        "proven optimum.",
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
                    _yes_no(data["finished"]),
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
        "show why. The scheduler columns are checked with the module validator and are zero. "
        'Units: "Outside availability" is prompts with no allowed slot, "Daily cap" is '
        'prompts above the per-participant daily cap, "Prompts over slot cap" is, per slot, '
        'the planned prompts above `max_prompts_per_slot`, summed over slots, and "Min-gap '
        "violating pairs\" counts pairs of one participant's prompts closer than the larger of "
        "their minimum gaps. A cut run (`Finished = no`) reports the best plan found within the "
        "budget, not a proven optimum.",
        (
            "Participants",
            "Method",
            "Planned",
            "Score",
            "Finished",
            "Outside availability",
            "Daily cap",
            "Prompts over slot cap",
            "Min-gap violating pairs",
        ),
        baseline_rows,
    )

    load_rows = []
    for row in report["load"]:
        for method, label in (
            ("scheduler", "scheduler"),
            ("scheduler_capacity", "scheduler + capacity"),
            ("fixed_hours", "fixed hours"),
        ):
            data = row[method]
            is_capacity = method == "scheduler_capacity"
            load_rows.append(
                (
                    row["participants"],
                    label,
                    row["capacity"] if is_capacity else "off",
                    data["planned"],
                    data["peak_prompts_per_slot"],
                    data["weighted_peak_per_slot"],
                    _number(data["weighted_variance_08_22"]),
                    data["slots_over_cap"],
                    data["slots_over_weighted_capacity"] if is_capacity else "-",
                    data["slot_cap_unplanned"],
                    data["prompts_lost_vs_scheduler"] if is_capacity else "-",
                    _yes_no(data["finished"]),
                )
            )
    lines += _section(
        "2. Load",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}. The weight comes "
        "from `Activity.weight`, the heaviest of the activity's entry types (video 5, photo 2, "
        'audio 2, text/scale/choice 1). Units: "Peak prompts per slot" is the maximum prompt '
        'count in any 15-minute slot over the whole day; "Weighted peak per slot" is the '
        'maximum weighted load in any slot over the whole day; "Weighted variance '
        '08:00-22:00" is the population variance over the 56 slots of that window, empty '
        'slots included; "Slots over slot cap" counts slots whose prompt count exceeds '
        '`max_prompts_per_slot`; "Slots over weighted capacity" counts slots whose weighted '
        "load exceeds `slot_capacity` (shown only for the capacity row, and it must be 0); "
        '"Unplanned (slot_cap)" counts prompts left with reason `slot_cap` and '
        '"Prompts lost vs scheduler" counts the prompts the capacity run left unplanned that '
        "the unconstrained scheduler planned. The scheduler + capacity row uses, per size, a "
        "`slot_capacity` equal to half of the unconstrained scheduler's weighted peak rounded "
        "up (the value is in the Slot capacity column), so the capacity binds. In a cut run the "
        'unplanned prompts are reported as `search_cut`, not `slot_cap`; the "Prompts lost vs '
        "scheduler\" column is then the honest measure of the capacity's effect. A cut run "
        "(`Finished = no`) reports the best plan found within the budget, not a proven optimum.",
        (
            "Participants",
            "Method",
            "Slot capacity",
            "Planned",
            "Peak prompts per slot",
            "Weighted peak per slot",
            "Weighted variance 08:00-22:00",
            "Slots over slot cap",
            "Slots over weighted capacity",
            "Unplanned (slot_cap)",
            "Prompts lost vs scheduler",
            "Finished",
        ),
        load_rows,
    )

    shared = report["shared_capacity"]
    shared_rows = [
        (
            study["role"],
            study["seed"],
            study["planned"],
            study["weighted_peak"],
            _yes_no(study["finished"]),
        )
        for study in shared["studies"]
    ]
    shared_rows.append(
        (
            "second study, independent",
            shared["independent"]["seed"],
            shared["independent"]["planned"],
            shared["independent"]["weighted_peak"],
            _yes_no(shared["independent"]["finished"]),
        )
    )
    lines += _section(
        "2b. Two studies sharing the capacity",
        f"two generated studies of {meta['shared_capacity_participants']} participants and "
        f"{meta['activity_count']} activities, seeds "
        f"{_join_numbers(meta['shared_capacity_seeds'])}, each with `slot_capacity="
        f"{shared['capacity']}`. The first study is planned alone. The second is planned twice: "
        "coordinated, with the first study's weighted load per slot passed as "
        '`external_slot_load`, and independent, alone. "Weighted peak per slot" is over the '
        "whole day. The combined weighted peak per slot is the maximum over slots of the sum of "
        "both studies' weighted loads. The coordinated combination must stay at or under the "
        "capacity; the independent one need not. A cut run (`Finished = no`) reports the best "
        "plan found within the budget, not a proven optimum. Combine: coordinated "
        f"{shared['combined_shared_peak']} (capacity {shared['capacity']}), independent "
        f"{shared['combined_independent_peak']}.",
        (
            "Study",
            "Seed",
            "Planned",
            "Weighted peak per slot",
            "Finished",
        ),
        shared_rows,
    )

    fairness_rows = []
    full_fairness_rows = []
    for row in report["fairness"]:
        for method, label in (("scheduler", "scheduler"), ("fixed_hours", "fixed hours")):
            data = row[method]
            fairness_rows.append(
                (
                    row["participants"],
                    label,
                    _yes_no(data["finished"]),
                    data["eligible_participants"],
                    data["excluded_participants"],
                    data["planned_min"],
                    _number(data["planned_mean"]),
                    data["planned_max"],
                    _number(data["planned_std"]),
                    _number(data["gini"], 3),
                    _number(data["ratio_min"], 3),
                    _number(data["ratio_mean"], 3),
                    data["requested"],
                )
            )
            full_fairness_rows.append(
                (
                    row["participants"],
                    label,
                    _yes_no(data["finished"]),
                    data["full_planned_min"],
                    _number(data["full_planned_mean"]),
                    data["full_planned_max"],
                    _number(data["full_planned_std"]),
                    _number(data["full_gini"], 3),
                    _number(data["full_ratio_min"], 3),
                    _number(data["full_ratio_mean"], 3),
                )
            )
    lines += _section(
        "3. Fairness",
        f"seed {meta['seed']}, sizes {sizes} participants, {meta['activity_count']} "
        f"activities, scheduler node budget {meta['scheduler_node_budget']}. The distribution "
        "covers only participants with at least one allowed slot on the plan date; "
        '"Excluded participants" counts the others (no allowed slot at all), and '
        '"Requested" counts only prompts whose domain (window intersected with availability) '
        "is non-empty before the search. Planned/requested is per eligible participant; std is "
        "the population standard deviation. The second table repeats the measures over every "
        "participant, excluded ones included. A cut run (`Finished = no`) reports the best plan "
        "found within the budget, not a proven optimum.",
        (
            "Participants",
            "Method",
            "Finished",
            "Eligible participants",
            "Excluded participants",
            "Min",
            "Mean",
            "Max",
            "Std (population)",
            "Gini",
            "Planned/requested min",
            "Planned/requested mean",
            "Requested",
        ),
        fairness_rows,
    )
    lines += _section(
        "3b. Fairness over the full population",
        "the same plans as table 3, distribution over every participant including those with no "
        "allowed slot on the plan date (whose requested count is zero and whose planned count is "
        "zero). Std is the population standard deviation; Gini is the same measure as in table 3.",
        (
            "Participants",
            "Method",
            "Finished",
            "All min",
            "All mean",
            "All max",
            "All std (population)",
            "All Gini",
            "All planned/requested min",
            "All planned/requested mean",
        ),
        full_fairness_rows,
    )

    coverage_rows = [
        (
            row["participants"],
            "scheduler" if row["method"] == "scheduler" else "fixed hours",
            f"{row['runs_finished']} of {row['runs']}",
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
        f"{meta['coverage_days']} consecutive days from {DEFAULT_PLAN_DATE.isoformat()}. Day 1 "
        "is seeded from the generated study's `History` (yesterday's prompts and the recent "
        "parts) for both methods; later days take yesterday's prompts and the parts covered in "
        "the last three days from the plans of the same method. The share is over participants "
        'whose availability allows at least one part of the day. "Runs finished" counts the '
        "daily plans whose search was not cut; a cut run reports the best plan found within the "
        "budget, not a proven optimum.",
        (
            "Participants",
            "Method",
            "Runs finished",
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
        f"{meta['quality_seed'] + quality['studies'] - 1}, {quality['studies']} generated "
        "studies with 2-5 participants, 2-3 activities and narrow overlapping windows of 30-120 "
        "minutes and varied minimum gaps. After the unconstrained plan exists, the daily cap and "
        "`max_prompts_per_slot` are tightened to that plan's largest per-participant and per-slot "
        "counts, so both caps bind and the plan stays feasible and optimal. Prompt counts per "
        f"study: min {quality['prompt_count_min']}, mean {_number(quality['prompt_count_mean'])}, "
        f"max {quality['prompt_count_max']}. "
        f"{quality['capacity_studies']} studies set a `slot_capacity` equal to half of the "
        "unconstrained scheduler's weighted peak rounded up; "
        f"{quality['binding_capacity_studies']} of them bind (the capacity is below that peak, or "
        "below the heaviest activity's weight when the unconstrained plan used only light "
        "prompts). Activities have distinct entry types. Scheduler node budget: none "
        "(`node_limit=None`), and every scheduler run finished (not cut). The scheduler uses the "
        "default options and is compared with an exact exhaustive search with safe pruning; the "
        "objective is the maximum planned count, then the maximum score. No column here is "
        "machine-dependent.",
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
            f"{row['metrics']['finished']} of {row['metrics']['runs']}",
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
        'deviation over the seeds; time ms is machine-dependent. "Runs finished" counts the '
        "seeds whose search was not cut; a cut run reports the best plan found within the "
        "budget, not a proven optimum.",
        (
            "Participants",
            "Seeds",
            "Runs finished",
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
        "Means over the seeds; time ms is machine-dependent. A cut run reports the best plan "
        "found within the budget, not a proven optimum.",
        (
            "Participants",
            "Variant",
            "Runs",
            "Planned mean",
            "Score mean",
            "Nodes mean",
            "Backtracks mean",
            f"Runs finished (of {len(meta['ablation_seeds'])})",
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


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"


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
