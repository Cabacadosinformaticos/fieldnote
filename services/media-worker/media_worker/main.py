import logging

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("fieldnote-media-worker started")


if __name__ == "__main__":
    main()
