"""Entry point of the scheduler service: ``python -m scheduler.main``."""

from __future__ import annotations

import logging
import signal

from .service import SchedulerService
from .settings import Settings

logger = logging.getLogger(__name__)


def main() -> None:
    settings = Settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    service = SchedulerService(settings)

    def _stop(signum: int, _frame: object) -> None:
        logger.info("signal %s received, stopping", signum)
        service.stop()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    try:
        service.run_forever()
    finally:
        service.close()


if __name__ == "__main__":
    main()
