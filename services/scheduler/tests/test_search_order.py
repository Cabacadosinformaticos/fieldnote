from datetime import UTC, datetime

from scheduler.model import FixedPrompt, Participant
from scheduler.plan import plan_day
from scheduler.solver import SearchOptions

from ._helpers import assert_valid_plan, make_activity, make_study

TIE_OPTIONS = SearchOptions(
    forward_checking=False,
    mrv=True,
    lcv=False,
    ac3=False,
    branch_and_bound=False,
)


def test_mrv_tie_prefers_the_participant_with_more_prompts_still_to_plan() -> None:
    sent = FixedPrompt("p1", "a", 0, datetime(2026, 11, 2, 8, 0, tzinfo=UTC))
    study = make_study(
        activities=(make_activity(prompts_per_day=2),),
        participants=(Participant("p1", any_time=True), Participant("p2", any_time=True)),
    )

    plan = plan_day(study, fixed_prompts=(sent,), node_limit=1, options=TIE_OPTIONS)
    replanned = [
        (prompt.participant_id, prompt.occurrence) for prompt in plan.planned if not prompt.fixed
    ]

    assert replanned == [("p2", 0)]
    assert_valid_plan(study, plan)


def test_mrv_ties_are_broken_by_participant_id_not_input_order() -> None:
    study = make_study(
        activities=(make_activity(prompts_per_day=2),),
        participants=(Participant("p2", any_time=True), Participant("p1", any_time=True)),
    )

    plan = plan_day(study, node_limit=1, options=TIE_OPTIONS)

    assert [(prompt.participant_id, prompt.occurrence) for prompt in plan.planned] == [("p1", 0)]
    assert_valid_plan(study, plan)
