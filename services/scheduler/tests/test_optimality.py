from datetime import UTC, datetime, time

import pytest

from scheduler.model import FixedPrompt, Participant
from scheduler.plan import plan_day

from ._helpers import (
    assert_valid_plan,
    brute_force_best,
    make_activity,
    make_study,
)


@pytest.mark.parametrize(
    "max_per_day,max_per_slot",
    [(2, 1), (2, 2), (1, 1)],
)
def test_tiny_study_matches_brute_force(max_per_day: int, max_per_slot: int) -> None:
    study = make_study(
        activities=(make_activity(start=time(8), end=time(8, 45)),),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=max_per_day,
        max_prompts_per_slot=max_per_slot,
    )

    plan = plan_day(study)

    assert plan.finished
    assert_valid_plan(study, plan)
    assert (plan.planned_count, plan.score) == brute_force_best(study)


def test_two_participants_match_brute_force_with_the_global_slot_cap() -> None:
    study = make_study(
        activities=(
            make_activity("a", start=time(8), end=time(8, 30)),
            make_activity("b", start=time(8), end=time(9)),
        ),
        participants=(Participant("p1", any_time=True), Participant("p2", any_time=True)),
        max_prompts_per_day=2,
        max_prompts_per_slot=1,
    )

    plan = plan_day(study)

    assert plan.finished
    assert_valid_plan(study, plan)
    assert (plan.planned_count, plan.score) == brute_force_best(study)


def test_fixed_prompt_with_seconds_matches_brute_force() -> None:
    sent = FixedPrompt("p", "a", 0, datetime(2026, 11, 2, 8, 0, 59, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2, min_gap_minutes=60),),
        participants=(Participant("p", any_time=True),),
    )

    plan = plan_day(study, fixed_prompts=(sent,))

    assert plan.finished
    assert_valid_plan(study, plan)
    assert (plan.planned_count, plan.score) == brute_force_best(study, (sent,))
