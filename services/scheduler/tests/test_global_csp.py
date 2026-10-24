from datetime import UTC, datetime, time

from scheduler.model import HistoricalPrompt, History, Participant, ScheduleStyle
from scheduler.plan import plan_day

from ._helpers import assert_valid_plan, make_activity, make_study, oracle_score


def test_whole_study_csp_saves_a_narrow_slot_for_the_other_participant() -> None:
    """Review finding 1: a per-participant planner loses p2's only narrow slot to p1's routine."""
    history = History(
        yesterday=(
            HistoricalPrompt(
                "p1",
                "wide",
                0,
                datetime(2026, 11, 1, 8, 15, tzinfo=UTC),
            ),
        )
    )
    study = make_study(
        activities=(
            make_activity("narrow", start=time(8), end=time(8, 30)),
            make_activity("wide", start=time(8), end=time(12)),
        ),
        participants=(Participant("p1", any_time=True), Participant("p2", any_time=True)),
        style=ScheduleStyle.FIXED,
        max_prompts_per_day=2,
        max_prompts_per_slot=1,
        history=history,
    )

    plan = plan_day(study)

    assert plan.finished
    assert plan.planned_count == 4
    assert not plan.unplanned
    assert_valid_plan(study, plan)
    assert plan.score == oracle_score(study, plan.planned)
    # p2's narrow prompt must get the slot p1's wide prompt gave up.
    p2_narrow = [
        prompt
        for prompt in plan.planned
        if prompt.participant_id == "p2" and prompt.activity_id == "narrow"
    ]
    assert len(p2_narrow) == 1
    p1_wide = [
        prompt
        for prompt in plan.planned
        if prompt.participant_id == "p1" and prompt.activity_id == "wide"
    ]
    assert p1_wide[0].scheduled_at.strftime("%H:%M") != "08:15"
