"""Entry point. It plans a generated study as a demonstration of the library."""

from __future__ import annotations

import logging

from .generator import generate_study
from .plan import plan_day

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("fieldnote-scheduler started")

    study_day = generate_study(seed=7, participant_count=5, activity_count=3)
    plan = plan_day(study_day, seed=7)
    logger.info(
        "planned=%d unplanned=%d score=%.1f nodes=%d finished=%s",
        plan.planned_count,
        plan.unplanned_count,
        plan.score,
        plan.nodes_expanded,
        plan.finished,
    )
    for prompt in plan.planned[:5]:
        logger.info(
            "%s %s #%d at %s",
            prompt.participant_id,
            prompt.activity_id,
            prompt.occurrence,
            prompt.scheduled_at.isoformat(),
        )
    for prompt in plan.unplanned[:5]:
        logger.info(
            "%s %s #%d unplanned: %s",
            prompt.participant_id,
            prompt.activity_id,
            prompt.occurrence,
            prompt.reason,
        )


if __name__ == "__main__":
    main()
