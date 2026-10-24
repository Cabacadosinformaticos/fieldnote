import pytest

from scheduler.evaluate import VARIANT_OPTIONS, run_evaluation
from scheduler.generator import generate_study
from scheduler.model import CutReason
from scheduler.plan import plan_day

from ._helpers import assert_valid_plan


@pytest.mark.parametrize(
    ("name", "options"),
    VARIANT_OPTIONS,
    ids=[name for name, _ in VARIANT_OPTIONS],
)
def test_each_ablation_variant_returns_a_valid_plan(name, options) -> None:
    study_day = generate_study(42, participant_count=2, activity_count=2)

    plan = plan_day(study_day, seed=42, node_limit=2_000, options=options)

    assert_valid_plan(study_day, plan)
    if plan.finished:
        assert plan.cut_reason is None
    else:
        assert plan.cut_reason is CutReason.NODE_LIMIT


def test_evaluation_prints_the_five_variant_table_with_one_budget(capsys) -> None:
    rows = run_evaluation(seed=2026, participant_count=2, activity_count=2, node_limit=300)
    output = capsys.readouterr().out

    assert [name for name, _, _, _, _ in rows] == [name for name, _ in VARIANT_OPTIONS]
    for _, nodes, backtracks, solve_ms, finished in rows:
        assert 0 <= nodes <= 300
        assert backtracks >= 0
        assert solve_ms >= 0
        assert isinstance(finished, bool)
    assert "Variant" in output
    assert "Nodes" in output
    assert "Backtracks" in output
    assert "Time (ms)" in output
    assert "Finished" in output
    for name, _ in VARIANT_OPTIONS:
        assert name in output
