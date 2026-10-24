from dataclasses import replace

import pytest

from scheduler.generator import generate_study
from scheduler.model import CutReason
from scheduler.plan import plan_day

from ._helpers import assert_valid_plan


@pytest.mark.parametrize("seed", range(200))
def test_generated_studies_have_no_hard_violations_and_are_deterministic(seed: int) -> None:
    study_day = generate_study(
        seed,
        participant_count=2 + seed % 4,
        activity_count=1 + seed % 3,
        with_history=bool(seed % 2),
    )

    first = plan_day(study_day, seed=seed, node_limit=2_000)
    second = plan_day(study_day, seed=seed, node_limit=2_000)

    assert first == second
    assert_valid_plan(study_day, first)
    if first.finished:
        assert first.cut_reason is None
    else:
        assert first.cut_reason is CutReason.NODE_LIMIT


def test_a_small_generated_study_finishes_and_has_no_cut_reason() -> None:
    study_day = generate_study(7, participant_count=1, activity_count=1)

    plan = plan_day(study_day, seed=7)

    assert plan.finished
    assert plan.cut_reason is None
    assert_valid_plan(study_day, plan)


def test_plan_is_invariant_to_the_order_of_the_input_lists() -> None:
    study_day = generate_study(1234, participant_count=4, activity_count=3)
    reordered = replace(
        study_day,
        activities=tuple(reversed(study_day.activities)),
        participants=tuple(reversed(study_day.participants)),
    )

    assert plan_day(study_day, seed=99) == plan_day(reordered, seed=99)


def test_different_seeds_still_produce_valid_plans() -> None:
    study_day = generate_study(77, participant_count=3, activity_count=3)

    for seed in (0, 1, 2):
        assert_valid_plan(study_day, plan_day(study_day, seed=seed, node_limit=2_000))
