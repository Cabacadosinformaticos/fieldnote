"""Tests for the evaluation suite, especially its exhaustive quality oracle."""

from __future__ import annotations

import pytest

from scheduler.evaluation_suite import exhaustive_best, generate_small_study

from ._helpers import brute_force_best


@pytest.mark.parametrize("seed", range(30))
def test_exhaustive_search_agrees_with_the_brute_force_oracle(seed: int) -> None:
    study_day = generate_small_study(seed, max_total_prompts=5)

    count, score = exhaustive_best(study_day)
    expected_count, expected_score = brute_force_best(study_day)

    assert count == expected_count
    assert score == pytest.approx(expected_score)
