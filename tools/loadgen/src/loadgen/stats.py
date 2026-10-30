"""Pure aggregation helpers behind the final report."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass


def percentile(values: list[float], fraction: float) -> float:
    """Linear-interpolation percentile, so small samples still give useful numbers."""
    if not values:
        return 0.0
    if not 0.0 <= fraction <= 1.0:
        raise ValueError("fraction must be between 0 and 1")
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def latency_percentiles(values: list[float]) -> dict[str, float]:
    return {
        "p50": percentile(values, 0.50),
        "p90": percentile(values, 0.90),
        "p99": percentile(values, 0.99),
    }


@dataclass(frozen=True)
class Comparison:
    """How the entries the generator attempted compare with the researcher's listing."""

    confirmed: int
    losses: int
    duplicates: int
    unexpected: int

    @property
    def ok(self) -> bool:
        return self.losses == 0 and self.duplicates == 0 and self.unexpected == 0


def compare_entries(expected_ids: list[str], listed_ids: list[str]) -> Comparison:
    """Count confirmations, losses and repetitions for the expected UUIDs.

    ``expected_ids`` holds one id per attempt, because an attempt is retried with the same UUID.
    A listing entry that was never attempted is unexpected: the study exists only for this run,
    so it would mean the report belongs to another study.
    """
    expected = set(expected_ids)
    counts = Counter(listed_ids)
    confirmed = sum(1 for entry_id in expected if counts.get(entry_id, 0) > 0)
    duplicates = sum(1 for entry_id in expected if counts.get(entry_id, 0) > 1)
    unexpected = sum(1 for entry_id in counts if entry_id not in expected)
    return Comparison(
        confirmed=confirmed,
        losses=len(expected) - confirmed,
        duplicates=duplicates,
        unexpected=unexpected,
    )


__all__ = ["Comparison", "compare_entries", "latency_percentiles", "percentile"]
