import time

from scheduler.generator import generate_study
from scheduler.plan import plan_day

from ._helpers import assert_valid_plan


def test_fifty_participants_and_four_activities_plan_under_two_seconds() -> None:
    study_day = generate_study(2026, participant_count=50, activity_count=4)

    started = time.perf_counter()
    plan = plan_day(study_day, seed=2026)
    elapsed = time.perf_counter() - started

    assert_valid_plan(study_day, plan)
    assert plan.planned_count > 0
    assert plan.nodes_expanded > 0
    assert elapsed < 2.0, f"planning took {elapsed:.3f}s"
