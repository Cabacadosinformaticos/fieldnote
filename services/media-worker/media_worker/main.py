import logging

from media_worker.config import settings
from media_worker.consumer import MediaConsumer, MediaJobProcessor
from media_worker.db import MediaObjectRepository
from media_worker.storage import ObjectStorage

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    processor = MediaJobProcessor(
        ObjectStorage(settings),
        MediaObjectRepository(settings.database_url),
        timeout=settings.ffmpeg_timeout_seconds,
    )
    logger.info("fieldnote-media-worker started")
    MediaConsumer(settings, processor).run()


if __name__ == "__main__":
    main()
