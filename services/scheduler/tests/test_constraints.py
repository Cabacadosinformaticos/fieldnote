from collections import Counter
from datetime import UTC, date, datetime, time

from scheduler.domains import minute_of_day, slot_index_of
from scheduler.model import (
    AvailabilityInterval,
    FixedPrompt,
    HistoricalPrompt,
    History,
    Participant,
    PlannedPrompt,
    RecentDayParts,
    ScheduleStyle,
)
from scheduler.plan import plan_day, replan_participant

from ._helpers import assert_valid_plan, make_activity, make_study, oracle_score


def test_min_gap_between_prompts_of_the_same_activity() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=2, min_gap_minutes=60),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study)

    assert plan.planned_count == 2
    assert not plan.unplanned
    first, second = sorted(plan.planned, key=lambda prompt: prompt.occurrence)
    distance = abs((first.scheduled_at - second.scheduled_at).total_seconds())
    assert distance >= 60 * 60


def test_the_larger_gap_applies_across_activities() -> None:
    study = make_study(
        activities=(
            make_activity("a", min_gap_minutes=30),
            make_activity("b", min_gap_minutes=120),
        ),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study)

    assert plan.planned_count == 2
    distance = abs((plan.planned[0].scheduled_at - plan.planned[1].scheduled_at).total_seconds())
    assert distance >= 120 * 60


def test_daily_cap_leaves_the_other_prompts_unplanned() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=3),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=2,
    )

    plan = plan_day(study)

    assert plan.planned_count == 2
    assert plan.unplanned_count == 1
    assert plan.unplanned[0].reason.value == "daily_cap"
    assert plan.finished


def test_slot_cap_is_respected_across_participants() -> None:
    study = make_study(
        activities=(make_activity("a", start=time(8), end=time(9)),),
        participants=tuple(Participant(f"p{index}", any_time=True) for index in range(3)),
        max_prompts_per_slot=1,
    )

    plan = plan_day(study)

    assert plan.planned_count == 3
    counts = Counter(
        slot_index_of(prompt.scheduled_at, study.study.time_zone) for prompt in plan.planned
    )
    assert max(counts.values()) == 1


def test_fixed_prompt_keeps_its_slot_and_stays_in_the_gap() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 9, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, min_gap_minutes=60),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study, fixed_prompts=(sent,))

    fixed = [prompt for prompt in plan.planned if prompt.fixed]
    assert len(fixed) == 1
    assert fixed[0].scheduled_at.strftime("%H:%M") == "09:00"
    remaining = [prompt for prompt in plan.planned if not prompt.fixed]
    assert len(remaining) == 1
    distance = abs(minute_of_day(remaining[0].scheduled_at, UTC) - minute_of_day(sent.scheduled_at))
    assert distance >= 60


def test_fixed_prompt_gap_keeps_the_seconds_of_its_timestamp() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 9, 0, 59, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, min_gap_minutes=60),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study, fixed_prompts=(sent,))

    remaining = [prompt for prompt in plan.planned if not prompt.fixed]
    assert len(remaining) == 1
    distance = abs((remaining[0].scheduled_at - sent.scheduled_at).total_seconds())
    assert distance >= 60 * 60
    assert remaining[0].scheduled_at.strftime("%H:%M") != "10:00"


def test_fixed_prompts_may_be_a_one_shot_iterable() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 9, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, min_gap_minutes=60),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study, fixed_prompts=iter((sent,)))

    assert plan.planned_count == 2
    assert sum(prompt.fixed for prompt in plan.planned) == 1
    assert_valid_plan(study, plan)


def test_fixed_prompt_counts_towards_the_daily_cap() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 9, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=1,
    )

    plan = plan_day(study, fixed_prompts=(sent,))

    assert plan.planned_count == 1
    assert plan.unplanned_count == 1
    assert plan.unplanned[0].reason.value == "daily_cap"


def test_fixed_prompt_counts_towards_the_slot_cap() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 8, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, start=time(8), end=time(8, 15)),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_slot=1,
    )

    plan = plan_day(study, fixed_prompts=(sent,))

    assert plan.planned_count == 1
    assert plan.unplanned_count == 1
    assert plan.unplanned[0].reason.value == "slot_cap"


def test_varied_style_prefers_a_slot_away_from_yesterday() -> None:
    history = History(
        yesterday=(HistoricalPrompt("p", "a", 0, datetime(2026, 11, 1, 9, 0, tzinfo=UTC)),),
        recent_parts=(RecentDayParts("p", frozenset({0, 1, 2, 3})),),
    )
    study = make_study(
        activities=(make_activity(),),
        participants=(Participant("p", any_time=True),),
        style=ScheduleStyle.VARIED,
        history=history,
    )

    plan = plan_day(study)

    assert plan.score == 1.0
    distance = abs(minute_of_day(plan.planned[0].scheduled_at, UTC) - (9 * 60))
    assert distance >= 60


def test_fixed_style_prefers_yesterdays_slot() -> None:
    history = History(
        yesterday=(HistoricalPrompt("p", "a", 0, datetime(2026, 11, 1, 9, 0, tzinfo=UTC)),),
        recent_parts=(RecentDayParts("p", frozenset({0, 1, 2, 3})),),
    )
    study = make_study(
        activities=(make_activity(),),
        participants=(Participant("p", any_time=True),),
        style=ScheduleStyle.FIXED,
        history=history,
    )

    plan = plan_day(study)

    assert plan.score == 1.0
    assert plan.planned[0].scheduled_at.strftime("%H:%M") == "09:00"


def test_balanced_style_weighs_both_terms_at_a_half() -> None:
    history = History(
        yesterday=(HistoricalPrompt("p", "a", 0, datetime(2026, 11, 1, 9, 0, tzinfo=UTC)),),
        recent_parts=(RecentDayParts("p", frozenset({0, 1, 2, 3})),),
    )
    study = make_study(
        activities=(make_activity(),),
        participants=(Participant("p", any_time=True),),
        style=ScheduleStyle.BALANCED,
        history=history,
    )

    plan = plan_day(study)

    assert plan.score == 0.5
    # 08:00 (variety) and 09:00 (routine) tie on score; the deterministic value order
    # then chooses the earlier slot.
    assert plan.planned[0].scheduled_at.strftime("%H:%M") == "08:00"


def test_variety_scores_a_part_not_covered_in_the_last_three_days() -> None:
    study = make_study(
        activities=(make_activity(),),
        participants=(Participant("p", any_time=True),),
        style=ScheduleStyle.VARIED,
    )

    plan = plan_day(study)

    assert plan.score == 1.0


def test_replan_keeps_sent_prompts_and_uses_the_other_participants_slots() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 8, 0, tzinfo=UTC))
    other = FixedPrompt("q", "a", 0, datetime(2026, 11, 2, 8, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, start=time(8), end=time(8, 15)),),
        participants=(Participant("p", any_time=True), Participant("q", any_time=True)),
        max_prompts_per_slot=1,
    )

    plan = replan_participant(
        study,
        "p",
        sent_prompts=(sent,),
        other_planned_prompts=(other,),
    )

    assert plan.planned_count == 1
    assert plan.planned[0].fixed
    assert plan.unplanned_count == 1
    assert plan.unplanned[0].reason.value == "slot_cap"


def test_replan_score_is_comparable_with_the_whole_day() -> None:
    other = FixedPrompt("q", "a", 0, datetime(2026, 11, 2, 10, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2),),
        participants=(Participant("p", any_time=True), Participant("q", any_time=True)),
    )

    plan = replan_participant(study, "p", other_planned_prompts=(other,))
    other_planned = PlannedPrompt(
        other.participant_id,
        other.activity_id,
        other.occurrence,
        other.scheduled_at,
        fixed=True,
    )

    assert {prompt.participant_id for prompt in plan.planned} == {"p"}
    assert plan.score == oracle_score(study, [*plan.planned, other_planned])


def test_replan_uses_the_new_availability() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 9, 0, tzinfo=UTC))
    participant = Participant(
        "p",
        availability=(AvailabilityInterval(time(14), time(16), frozenset({1})),),
    )
    study = make_study(
        activities=(
            make_activity(prompts_per_day=2, min_gap_minutes=60, start=time(14), end=time(18)),
        ),
        participants=(participant,),
        plan_date=date(2026, 11, 2),
    )

    plan = replan_participant(study, "p", sent_prompts=(sent,))

    assert plan.planned_count == 2
    remaining = [prompt for prompt in plan.planned if not prompt.fixed]
    assert len(remaining) == 1
    assert remaining[0].scheduled_at.hour >= 14
    assert remaining[0].scheduled_at.hour < 16
