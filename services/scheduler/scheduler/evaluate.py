"""Run the five ablation variants of scheduler.md:169-181 and print their table."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TextIO

from .generator import generate_study
from .plan import plan_day
from .solver import DEFAULT_NODE_LIMIT, SearchOptions

VARIANT_OPTIONS: tuple[tuple[str, SearchOptions], ...] = (
    (
        "plain backtracking",
        SearchOptions(
            forward_checking=False,
            mrv=False,
            lcv=False,
            ac3=False,
            branch_and_bound=False,
        ),
    ),
    (
        "+ forward checking",
        SearchOptions(
            forward_checking=True,
            mrv=False,
            lcv=False,
            ac3=False,
            branch_and_bound=False,
        ),
    ),
    (
        "+ MRV",
        SearchOptions(
            forward_checking=True,
            mrv=True,
            lcv=False,
            ac3=False,
            branch_and_bound=False,
        ),
    ),
    (
        "+ LCV",
        SearchOptions(
            forward_checking=True,
            mrv=True,
            lcv=True,
            ac3=False,
            branch_and_bound=False,
        ),
    ),
    (
        "+ AC-3",
        SearchOptions(
            forward_checking=True,
            mrv=True,
            lcv=True,
            ac3=True,
            branch_and_bound=False,
        ),
    ),
)


def run_evaluation(
    *,
    seed: int = 2026,
    participant_count: int = 10,
    activity_count: int = 3,
    node_limit: int | None = DEFAULT_NODE_LIMIT,
    output: TextIO | None = None,
) -> Sequence[tuple[str, int, int, int, bool]]:
    """Run every variant on the same instance with the same node budget."""
    study_day = generate_study(
        seed, participant_count=participant_count, activity_count=activity_count
    )
    rows: list[tuple[str, int, int, int, bool]] = []
    for name, options in VARIANT_OPTIONS:
        plan = plan_day(study_day, seed=seed, node_limit=node_limit, options=options)
        rows.append(
            (
                name,
                plan.nodes_expanded,
                plan.backtracks,
                plan.solve_ms,
                plan.finished,
            )
        )
    _print_table(rows, output)
    return rows


def _print_table(rows: Sequence[tuple[str, int, int, int, bool]], output: TextIO | None) -> None:
    destination = output
    header = f"{'Variant':<20} {'Nodes':>10} {'Backtracks':>12} {'Time (ms)':>10} {'Finished':>9}"
    print(header, file=destination)
    print("-" * len(header), file=destination)
    for name, nodes, backtracks, solve_ms, finished in rows:
        print(
            f"{name:<20} {nodes:>10} {backtracks:>12} {solve_ms:>10} "
            f"{'yes' if finished else 'no':>9}",
            file=destination,
        )


def main() -> None:
    run_evaluation()


if __name__ == "__main__":
    main()


__all__ = ["VARIANT_OPTIONS", "main", "run_evaluation"]
