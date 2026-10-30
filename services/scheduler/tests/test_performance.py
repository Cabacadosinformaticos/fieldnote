import json
import time
from collections import Counter
from datetime import date, datetime
from datetime import time as clock_time
from pathlib import Path
from zoneinfo import ZoneInfo

from scheduler.generator import generate_study
from scheduler.model import (
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
from scheduler.plan import plan_day

from ._helpers import assert_valid_plan, oracle_slots

FIXTURES = Path(__file__).parent / "fixtures"

# The defaults of scheduler.settings.Settings, which the service passes to plan_day.
PRODUCTION_NODE_LIMIT = 1_000_000
PRODUCTION_TIME_LIMIT_SECONDS = 10.0


def _demo_study_day() -> StudyDay:
    """The demo study as it was loaded on 2026-11-02 at 19:15 local time."""
    raw = json.loads((FIXTURES / "demo-study-2026-11-02.json").read_text(encoding="utf-8"))
    settings = raw["study"]
    activities = tuple(
        Activity(
            id=activity["id"],
            prompts_per_day=activity["prompts_per_day"],
            min_gap_minutes=activity["min_gap_minutes"],
            window=TimeWindow(
                start=clock_time.fromisoformat(activity["window_start"]),
                end=clock_time.fromisoformat(activity["window_end"]),
            ),
        )
        for activity in raw["activities"]
    )
    participants = tuple(
        Participant(
            id=participant["id"],
            any_time=participant["any_time"],
            availability=tuple(
                AvailabilityInterval(
                    start=clock_time.fromisoformat(interval["start_time"]),
                    end=clock_time.fromisoformat(interval["end_time"]),
                    weekdays=frozenset(interval["weekdays"]),
                )
                for interval in participant["availability"]
            ),
        )
        for participant in raw["participants"]
    )
    history = History(
        yesterday=tuple(
            HistoricalPrompt(
                item["participant_id"],
                item["activity_id"],
                item["occurrence"],
                datetime.fromisoformat(item["scheduled_at"]),
            )
            for item in raw["history"]["yesterday"]
        ),
        recent_parts=tuple(
            RecentDayParts(item["participant_id"], frozenset(item["parts"]))
            for item in raw["history"]["recent_parts"]
        ),
    )
    return StudyDay(
        study=StudyConfig(
            id=settings["id"],
            schedule_style=ScheduleStyle(settings["schedule_style"]),
            max_prompts_per_day=settings["max_prompts_per_day"],
            max_prompts_per_slot=settings["max_prompts_per_slot"],
            time_zone=ZoneInfo(settings["time_zone"]),
        ),
        plan_date=date.fromisoformat(raw["plan_date"]),
        activities=activities,
        participants=participants,
        history=history,
    )


def _greedy_planned_count(study_day: StudyDay) -> int:
    """A deterministic earliest-slot greedy pass, checked by the independent oracle."""
    slot_counts: Counter[int] = Counter()
    daily: Counter[str] = Counter()
    placed: dict[str, list[tuple[int, Activity]]] = {}
    variables = [
        (participant, activity)
        for participant in study_day.participants
        for activity in study_day.activities
    ]
    variables.sort(
        key=lambda item: (
            len(oracle_slots(study_day, item[0], item[1])),
            item[0].id,
            item[1].id,
        )
    )
    for participant, activity in variables:
        if daily[participant.id] >= study_day.study.max_prompts_per_day:
            continue
        for minute in oracle_slots(study_day, participant, activity):
            if slot_counts[minute] >= study_day.study.max_prompts_per_slot:
                continue
            if any(
                abs(minute - other) < max(activity.min_gap_minutes, other_activity.min_gap_minutes)
                for other, other_activity in placed.get(participant.id, [])
            ):
                continue
            slot_counts[minute] += 1
            daily[participant.id] += 1
            placed.setdefault(participant.id, []).append((minute, activity))
            break
    return sum(daily.values())


def test_fifty_participants_and_four_activities_plan_under_two_seconds() -> None:
    study_day = generate_study(2026, participant_count=50, activity_count=4)

    started = time.perf_counter()
    plan = plan_day(study_day, seed=2026)
    elapsed = time.perf_counter() - started

    assert_valid_plan(study_day, plan)
    assert plan.planned_count > 0
    assert plan.nodes_expanded > 0
    assert elapsed < 2.0, f"planning took {elapsed:.3f}s"


def test_demo_study_plans_at_least_as_many_prompts_as_a_greedy_pass() -> None:
    study_day = _demo_study_day()
    greedy = _greedy_planned_count(study_day)

    plan = plan_day(
        study_day,
        node_limit=PRODUCTION_NODE_LIMIT,
        time_limit_seconds=PRODUCTION_TIME_LIMIT_SECONDS,
    )

    assert_valid_plan(study_day, plan)
    assert plan.finished or plan.planned_count >= greedy
