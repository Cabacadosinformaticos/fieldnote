"""Independent oracles and checks used by the tests.

Nothing here calls the solver's slot, availability or scoring helpers: the point is to catch a
bug in the implementation, not to repeat it.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from datetime import date, datetime, time, tzinfo
from itertools import product

from scheduler.model import (
    Activity,
    DayPlan,
    FixedPrompt,
    History,
    Participant,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    TimeWindow,
    UnplannedReason,
)

SLOT_MINUTES = 15

STYLE_WEIGHTS = {
    "varied": (1.0, 0.0),
    "fixed": (0.0, 1.0),
    "balanced": (0.5, 0.5),
}


def make_study(
    *,
    activities: tuple[Activity, ...],
    participants: tuple[Participant, ...],
    plan_date: date = date(2026, 11, 2),
    style: ScheduleStyle = ScheduleStyle.VARIED,
    max_prompts_per_day: int = 10,
    max_prompts_per_slot: int = 10,
    history: History | None = None,
) -> StudyDay:
    return StudyDay(
        study=StudyConfig(
            id="test-study",
            schedule_style=style,
            max_prompts_per_day=max_prompts_per_day,
            max_prompts_per_slot=max_prompts_per_slot,
        ),
        plan_date=plan_date,
        activities=activities,
        participants=participants,
        history=history or History(),
    )


def make_activity(
    activity_id: str = "a",
    prompts_per_day: int = 1,
    min_gap_minutes: int = 0,
    start: time = time(8),
    end: time = time(12),
) -> Activity:
    return Activity(
        id=activity_id,
        prompts_per_day=prompts_per_day,
        min_gap_minutes=min_gap_minutes,
        window=TimeWindow(start=start, end=end),
    )


def _seconds(value: time) -> int:
    return value.hour * 3600 + value.minute * 60 + value.second


def oracle_slots(
    study_day: StudyDay, participant: Participant, activity: Activity
) -> tuple[int, ...]:
    """Slots that a separate implementation considers valid for this activity and participant.

    Slots are minutes since midnight. A slot belongs to a window or availability interval when
    its aligned start is inside the half-open span, as scheduler.md:22-23 describes the domain.
    """
    window_start = _seconds(activity.window.start)
    window_end = _seconds(activity.window.end)
    weekday = study_day.plan_date.isoweekday()
    result: list[int] = []
    for minute in range(0, 24 * 60, SLOT_MINUTES):
        slot_start = minute * 60
        if slot_start < window_start or slot_start >= window_end:
            continue
        if participant.any_time:
            result.append(minute)
            continue
        for interval in participant.availability:
            if weekday not in interval.weekdays:
                continue
            if _seconds(interval.start) <= slot_start < _seconds(interval.end):
                result.append(minute)
                break
    return tuple(result)


def oracle_part(minute: int) -> int | None:
    """The four scheduler.md parts, with no credit outside 08:00-22:00."""
    if 8 * 60 <= minute < 11 * 60:
        return 0
    if 11 * 60 <= minute < 14 * 60:
        return 1
    if 14 * 60 <= minute < 18 * 60:
        return 2
    if 18 * 60 <= minute < 22 * 60:
        return 3
    return None


def _aware(value: datetime, time_zone: tzinfo) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=time_zone)
    return value.astimezone(time_zone)


def _minute_of_day(value: datetime, time_zone: tzinfo) -> int:
    local = _aware(value, time_zone)
    return local.hour * 60 + local.minute


def oracle_score(study_day: StudyDay, planned: Iterable[object]) -> float:
    """An independent implementation of the soft preference score of scheduler.md:36-49."""
    variety_weight, routine_weight = STYLE_WEIGHTS[str(study_day.study.schedule_style)]
    yesterday = {
        (item.participant_id, item.activity_id, item.occurrence): _minute_of_day(
            item.scheduled_at, study_day.study.time_zone
        )
        for item in study_day.history.yesterday
    }
    recent: dict[str, set[int]] = {}
    for item in study_day.history.recent_parts:
        recent.setdefault(item.participant_id, set()).update(item.parts)

    covered: dict[str, set[int]] = {}
    score = 0.0
    for prompt in planned:
        minute = _minute_of_day(prompt.scheduled_at, study_day.study.time_zone)
        equivalent = yesterday.get((prompt.participant_id, prompt.activity_id, prompt.occurrence))
        if equivalent is not None:
            if abs(minute - equivalent) >= 60:
                score += variety_weight
            if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
                score += routine_weight
        part = oracle_part(minute)
        if part is not None:
            covered.setdefault(prompt.participant_id, set()).add(part)

    for participant_id, parts in covered.items():
        for part in parts:
            if part not in recent.get(participant_id, set()):
                score += variety_weight
    return score


def assert_valid_plan(study_day: StudyDay, plan: DayPlan) -> None:
    """Check every hard constraint against the input using the independent oracles above."""
    activities = {activity.id: activity for activity in study_day.activities}
    participants = {participant.id: participant for participant in study_day.participants}
    study = study_day.study

    expected = {
        (participant.id, activity.id, occurrence)
        for participant in study_day.participants
        for activity in study_day.activities
        for occurrence in range(activity.prompts_per_day)
    }
    planned_keys = [(p.participant_id, p.activity_id, p.occurrence) for p in plan.planned]
    unplanned_keys = [(p.participant_id, p.activity_id, p.occurrence) for p in plan.unplanned]
    assert len(planned_keys) == len(set(planned_keys)), "duplicate planned prompt"
    assert len(unplanned_keys) == len(set(unplanned_keys)), "duplicate unplanned prompt"
    assert set(planned_keys) | set(unplanned_keys) == expected
    assert not set(planned_keys) & set(unplanned_keys)

    for prompt in plan.planned:
        activity = activities[prompt.activity_id]
        participant = participants[prompt.participant_id]
        local = _aware(prompt.scheduled_at, study.time_zone)
        minute = local.hour * 60 + local.minute
        if prompt.fixed:
            assert _seconds(activity.window.start) <= minute * 60 < _seconds(activity.window.end)
        else:
            assert local.date() == study_day.plan_date
            assert local.second == 0 and local.microsecond == 0
            assert minute in oracle_slots(study_day, participant, activity), (
                f"{prompt} is not in the independent availability oracle"
            )

    assert all(isinstance(prompt.reason, UnplannedReason) for prompt in plan.unplanned)
    if plan.finished:
        assert all(prompt.reason is not UnplannedReason.SEARCH_CUT for prompt in plan.unplanned), (
            "a finished search cannot report search_cut"
        )

    for participant_id in participants:
        mine = [p for p in plan.planned if p.participant_id == participant_id]
        assert len(mine) <= study.max_prompts_per_day
        for index, left in enumerate(mine):
            for right in mine[index + 1 :]:
                gap = max(
                    activities[left.activity_id].min_gap_minutes,
                    activities[right.activity_id].min_gap_minutes,
                )
                distance = abs(
                    (
                        _aware(left.scheduled_at, study.time_zone)
                        - _aware(right.scheduled_at, study.time_zone)
                    ).total_seconds()
                )
                assert distance >= gap * 60, f"min gap violated: {left} and {right}"

    per_slot = Counter(
        _minute_of_day(prompt.scheduled_at, study.time_zone) // SLOT_MINUTES
        for prompt in plan.planned
    )
    assert all(count <= study.max_prompts_per_slot for count in per_slot.values())

    assert plan.score >= 0
    assert plan.score == oracle_score(study_day, plan.planned)
    assert plan.nodes_expanded >= 0
    assert plan.backtracks >= 0


class _PlannedView:
    """Minimal prompt view for the independent score oracle."""

    def __init__(
        self,
        participant_id: str,
        activity_id: str,
        occurrence: int,
        scheduled_at: datetime,
    ) -> None:
        self.participant_id = participant_id
        self.activity_id = activity_id
        self.occurrence = occurrence
        self.scheduled_at = scheduled_at


def timeline_reasons(plan: DayPlan) -> list[tuple[str, str, int, UnplannedReason]]:
    """The unplanned prompts as exact, sorted tuples, for reason assertions."""
    return [
        (prompt.participant_id, prompt.activity_id, prompt.occurrence, prompt.reason)
        for prompt in sorted(
            plan.unplanned,
            key=lambda item: (item.participant_id, item.activity_id, item.occurrence),
        )
    ]


def brute_force_best(
    study_day: StudyDay, fixed_prompts: tuple[FixedPrompt, ...] = ()
) -> tuple[int, float]:
    """Enumerate every tiny assignment and return the optimal (planned count, score)."""
    fixed_keys = {
        (prompt.participant_id, prompt.activity_id, prompt.occurrence) for prompt in fixed_prompts
    }
    variables: list[tuple[str, Activity, int]] = []
    domains: list[tuple[int, ...]] = []
    participants = {participant.id: participant for participant in study_day.participants}
    for participant in study_day.participants:
        for activity in study_day.activities:
            for occurrence in range(activity.prompts_per_day):
                if (participant.id, activity.id, occurrence) in fixed_keys:
                    continue
                variables.append((participant.id, activity, occurrence))
                domains.append(oracle_slots(study_day, participants[participant.id], activity))

    best: tuple[int, float] | None = None
    choices = [(None, *domain) for domain in domains]
    for values in product(*choices):
        planned: list[FixedPrompt | _PlannedView] = list(fixed_prompts)
        for (participant_id, activity, occurrence), minute in zip(variables, values, strict=True):
            if minute is not None:
                planned.append(
                    _PlannedView(
                        participant_id,
                        activity.id,
                        occurrence,
                        datetime.combine(
                            study_day.plan_date,
                            time(hour=minute // 60, minute=minute % 60),
                            tzinfo=study_day.study.time_zone,
                        ),
                    )
                )
        if not _valid_assignment(study_day, planned):
            continue
        score = oracle_score(study_day, planned)
        candidate = len(planned), score
        if best is None or candidate > best:
            best = candidate
    assert best is not None
    return best


def _valid_assignment(study_day: StudyDay, planned: list[FixedPrompt | _PlannedView]) -> bool:
    activities = {activity.id: activity for activity in study_day.activities}
    daily: Counter[str] = Counter()
    slots: Counter[int] = Counter()
    for prompt in planned:
        daily[prompt.participant_id] += 1
        slots[_minute_of_day(prompt.scheduled_at, study_day.study.time_zone) // SLOT_MINUTES] += 1
    if any(count > study_day.study.max_prompts_per_day for count in daily.values()):
        return False
    if any(count > study_day.study.max_prompts_per_slot for count in slots.values()):
        return False
    for index, left in enumerate(planned):
        for right in planned[index + 1 :]:
            if left.participant_id != right.participant_id:
                continue
            gap = max(
                activities[left.activity_id].min_gap_minutes,
                activities[right.activity_id].min_gap_minutes,
            )
            distance = abs(
                (
                    _aware(left.scheduled_at, study_day.study.time_zone)
                    - _aware(right.scheduled_at, study_day.study.time_zone)
                ).total_seconds()
            )
            if distance < gap * 60:
                return False
    return True
