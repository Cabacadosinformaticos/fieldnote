"""Deterministic synthetic studies for tests, the evaluation and a later load generator."""

from __future__ import annotations

import random
from datetime import UTC, date, datetime, time, timedelta

from .domains import minute_to_time
from .model import (
    Activity,
    AvailabilityInterval,
    HistoricalPrompt,
    History,
    Participant,
    RecentDayParts,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    TimeWindow,
)

DEFAULT_PLAN_DATE = date(2026, 11, 2)
EARLIEST = 6 * 60
LATEST = 22 * 60


def generate_study(
    seed: int,
    *,
    participant_count: int = 10,
    activity_count: int = 4,
    plan_date: date | None = None,
    with_history: bool = True,
) -> StudyDay:
    """Build a reproducible study from ``seed``.

    The generator varies the schedule style, the limits, the number of prompts, the windows,
    the gaps, the availability intervals (including "any time") and, when asked, yesterday's
    plan and the parts of the day covered in the last three days.
    """
    if participant_count < 0:
        raise ValueError("participant_count must not be negative")
    if activity_count < 0:
        raise ValueError("activity_count must not be negative")
    rng = random.Random(seed)
    plan_date = plan_date or DEFAULT_PLAN_DATE
    style = rng.choice(list(ScheduleStyle))
    max_prompts_per_day = rng.randint(max(1, activity_count), max(2, activity_count * 2 + 1))
    span = max(1, participant_count)
    max_prompts_per_slot = rng.randint(1, max(1, span // 4 + 1))

    activities = tuple(_generate_activity(rng, index) for index in range(activity_count))
    participants = tuple(
        _generate_participant(rng, index, plan_date) for index in range(participant_count)
    )
    history = (
        _generate_history(rng, participants, activities, plan_date) if with_history else History()
    )
    study = StudyConfig(
        id=f"study-{seed}",
        schedule_style=style,
        max_prompts_per_day=max_prompts_per_day,
        max_prompts_per_slot=max_prompts_per_slot,
        time_zone=UTC,
    )
    return StudyDay(
        study=study,
        plan_date=plan_date,
        activities=activities,
        participants=participants,
        history=history,
    )


def _generate_activity(rng: random.Random, index: int) -> Activity:
    start_hour = rng.choice((7, 8, 8, 9, 9))
    end_hour = rng.choice((19, 20, 21, 22))
    if end_hour <= start_hour:
        end_hour = start_hour + 4
    prompts_per_day = rng.choice((1, 1, 1, 2))
    gap = rng.choice((0, 30, 45, 60, 90, 120))
    return Activity(
        id=f"activity-{index:02d}",
        prompts_per_day=prompts_per_day,
        min_gap_minutes=gap,
        window=TimeWindow(time(hour=start_hour), time(hour=end_hour)),
    )


def _generate_participant(rng: random.Random, index: int, plan_date: date) -> Participant:
    if rng.random() < 0.25:
        return Participant(id=f"participant-{index:03d}", any_time=True)

    intervals: list[AvailabilityInterval] = []
    for _ in range(rng.randint(1, 2)):
        start = rng.randrange(EARLIEST // 15, (LATEST - 60) // 15) * 15
        end = min(start + rng.randint(4, 40) * 15, LATEST)
        if end <= start:
            continue
        weekdays = frozenset(rng.sample(range(1, 8), rng.randint(1, 7)))
        if rng.random() < 0.05:
            # A few participants are unavailable on the plan date, to exercise the reason.
            alternatives = tuple(day for day in weekdays if day != plan_date.isoweekday())
            weekdays = frozenset(alternatives or ((plan_date.isoweekday() % 7) + 1,))
        intervals.append(
            AvailabilityInterval(
                start=minute_to_time(start), end=minute_to_time(end), weekdays=weekdays
            )
        )
    return Participant(id=f"participant-{index:03d}", availability=tuple(intervals))


def _generate_history(
    rng: random.Random,
    participants: tuple[Participant, ...],
    activities: tuple[Activity, ...],
    plan_date: date,
) -> History:
    yesterday = plan_date - timedelta(days=1)
    historical: list[HistoricalPrompt] = []
    recent: list[RecentDayParts] = []
    for participant in participants:
        covered = frozenset(rng.sample(range(4), rng.randint(1, 4)))
        recent.append(RecentDayParts(participant.id, covered))
        for activity in activities:
            for occurrence in range(activity.prompts_per_day):
                if rng.random() >= 0.6:
                    continue
                start = activity.window.start.hour * 60 + activity.window.start.minute
                end = activity.window.end.hour * 60 + activity.window.end.minute
                slots = max(1, (end - start) // 15)
                minute = start + rng.randrange(slots) * 15
                historical.append(
                    HistoricalPrompt(
                        participant_id=participant.id,
                        activity_id=activity.id,
                        occurrence=occurrence,
                        scheduled_at=datetime.combine(
                            yesterday, minute_to_time(minute), tzinfo=UTC
                        ),
                    )
                )
    return History(yesterday=tuple(historical), recent_parts=tuple(recent))


__all__ = ["DEFAULT_PLAN_DATE", "generate_study"]
