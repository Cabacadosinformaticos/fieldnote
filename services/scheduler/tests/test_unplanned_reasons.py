from datetime import UTC, date, datetime, time

from scheduler.model import (
    AvailabilityInterval,
    CutReason,
    FixedPrompt,
    Participant,
    UnplannedReason,
)
from scheduler.plan import plan_day

from ._helpers import make_activity, make_study, timeline_reasons


def test_outside_availability_when_the_weekday_does_not_match() -> None:
    participant = Participant(
        "p", availability=(AvailabilityInterval(time(8), time(12), frozenset({2})),)
    )
    study = make_study(
        activities=(make_activity(),),
        participants=(participant,),
        plan_date=date(2026, 11, 2),  # Monday
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 0, UnplannedReason.OUTSIDE_AVAILABILITY)]
    assert plan.finished


def test_outside_availability_when_the_intervals_do_not_overlap_the_window() -> None:
    participant = Participant(
        "p", availability=(AvailabilityInterval(time(14), time(16), frozenset({1})),)
    )
    study = make_study(
        activities=(make_activity(start=time(8), end=time(12)),),
        participants=(participant,),
        plan_date=date(2026, 11, 2),
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 0, UnplannedReason.OUTSIDE_AVAILABILITY)]


def test_min_gap_infeasible_when_the_gap_does_not_fit_the_window() -> None:
    study = make_study(
        activities=(
            make_activity(prompts_per_day=2, min_gap_minutes=180, start=time(8), end=time(10)),
        ),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 0, UnplannedReason.MIN_GAP_INFEASIBLE)]
    assert [prompt.occurrence for prompt in plan.planned] == [1]
    assert plan.finished


def test_daily_cap_reason_is_exactly_the_third_prompt() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=3),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=2,
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 2, UnplannedReason.DAILY_CAP)]


def test_slot_cap_reason_is_the_prompt_left_without_a_slot() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=2, start=time(8), end=time(8, 15)),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_slot=1,
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 1, UnplannedReason.SLOT_CAP)]
    assert plan.finished


def test_slot_cap_wins_over_daily_cap_when_it_removed_the_last_value() -> None:
    """The case from review finding 6: two prompts share the only slot of activity a."""
    study = make_study(
        activities=(
            make_activity("a", prompts_per_day=2, start=time(8), end=time(8, 15)),
            make_activity("b", prompts_per_day=1, start=time(9), end=time(9, 15)),
        ),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=2,
        max_prompts_per_slot=1,
    )

    plan = plan_day(study)

    assert timeline_reasons(plan) == [("p", "a", 1, UnplannedReason.SLOT_CAP)]
    assert plan.finished


def test_search_cut_reason_when_the_node_limit_stops_the_search() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=2),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study, node_limit=0)

    assert not plan.finished
    assert plan.cut_reason is CutReason.NODE_LIMIT
    assert timeline_reasons(plan) == [
        ("p", "a", 0, UnplannedReason.SEARCH_CUT),
        ("p", "a", 1, UnplannedReason.SEARCH_CUT),
    ]


def test_wall_clock_limit_is_off_by_default_and_reported_when_requested() -> None:
    study = make_study(
        activities=(make_activity(),),
        participants=(Participant("p", any_time=True),),
    )

    default = plan_day(study, node_limit=None)
    cut = plan_day(study, node_limit=None, time_limit_seconds=0.0)

    assert default.finished
    assert default.cut_reason is None
    assert not cut.finished
    assert cut.cut_reason is CutReason.TIME_LIMIT
    assert timeline_reasons(cut) == [("p", "a", 0, UnplannedReason.SEARCH_CUT)]


def test_search_cut_wins_over_slot_cap_when_the_plan_is_not_proven() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=2, start=time(8), end=time(8, 15)),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_slot=1,
    )

    plan = plan_day(study, node_limit=1)

    assert plan.cut_reason is CutReason.NODE_LIMIT
    assert timeline_reasons(plan) == [("p", "a", 1, UnplannedReason.SEARCH_CUT)]


def test_daily_cap_wins_over_search_cut_when_a_fixed_prompt_filled_the_counter() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 8, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=3),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=1,
    )

    plan = plan_day(study, fixed_prompts=(sent,), node_limit=0)

    assert plan.finished
    assert timeline_reasons(plan) == [
        ("p", "a", 1, UnplannedReason.DAILY_CAP),
        ("p", "a", 2, UnplannedReason.DAILY_CAP),
    ]


def test_a_window_shorter_than_a_slot_is_planned_at_its_aligned_start() -> None:
    study = make_study(
        activities=(make_activity(start=time(8), end=time(8, 10)),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study)

    assert not plan.unplanned
    assert plan.planned[0].scheduled_at.strftime("%H:%M") == "08:00"
