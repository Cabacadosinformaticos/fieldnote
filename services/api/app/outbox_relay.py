"""Publish unpublished outbox events to RabbitMQ.

Run with ``python -m app.outbox_relay``. Every API replica may run it: a batch is claimed with
``SELECT ... FOR UPDATE SKIP LOCKED``, published with publisher confirms and only then marked as
published. A relay that dies between the publish and the commit publishes the event again, so
consumers must treat events as at least once.
"""

import json
import logging
import time
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from datetime import UTC, datetime
from typing import Protocol

import pika
from pika.adapters.blocking_connection import BlockingChannel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db import SessionLocal
from app.models import OutboxEvent
from app.services.outbox import MEDIA_PROCESS_EVENT

logger = logging.getLogger(__name__)

EVENTS_EXCHANGE = "fieldnote.events"
MEDIA_QUEUE = "media.process"
BATCH_SIZE = 100
IDLE_SECONDS = 1.0
RECONNECT_MAX_SECONDS = 30.0


class Publisher(Protocol):
    def publish(self, event_type: str, payload: dict[str, object]) -> None: ...


class PikaPublisher:
    """Publisher with confirms, routing media jobs to their queue and the rest to the fan-out."""

    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings.rabbitmq_url
        self._connection: pika.BlockingConnection | None = None
        self._channel: BlockingChannel | None = None

    def __enter__(self) -> "PikaPublisher":
        self.connect()
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.close()

    def connect(self) -> None:
        parameters = pika.URLParameters(self._url)
        parameters.heartbeat = 60
        parameters.blocked_connection_timeout = 30
        self._connection = pika.BlockingConnection(parameters)
        channel = self._connection.channel()
        channel.confirm_delivery()
        channel.exchange_declare(exchange=EVENTS_EXCHANGE, exchange_type="fanout", durable=True)
        self._channel = channel

    def close(self) -> None:
        if self._connection is not None and self._connection.is_open:
            self._connection.close()
        self._connection = None
        self._channel = None

    def publish(self, event_type: str, payload: dict[str, object]) -> None:
        if self._channel is None:
            raise RuntimeError("The publisher is not connected.")
        body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
        properties = pika.BasicProperties(content_type="application/json", delivery_mode=2)
        if event_type == MEDIA_PROCESS_EVENT:
            # The media worker owns the queue; mandatory makes the broker return the event while
            # the queue does not exist, so the relay keeps it in the database instead of losing it.
            self._channel.basic_publish(
                exchange="",
                routing_key=MEDIA_QUEUE,
                body=body,
                properties=properties,
                mandatory=True,
            )
        else:
            self._channel.basic_publish(
                exchange=EVENTS_EXCHANGE,
                routing_key=event_type,
                body=body,
                properties=properties,
            )


def relay_once(session: Session, publisher: Publisher, batch_size: int = BATCH_SIZE) -> int:
    """Publish one batch and commit. Raises if publishing fails, leaving the rows unpublished."""
    events = session.scalars(
        select(OutboxEvent)
        .where(OutboxEvent.published_at.is_(None))
        .order_by(OutboxEvent.id)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    ).all()
    if not events:
        return 0

    published_at = datetime.now(UTC)
    for event in events:
        publisher.publish(event.event_type, event.payload)
        event.published_at = published_at
    session.commit()
    return len(events)


@contextmanager
def _publisher() -> Iterator[PikaPublisher]:
    with PikaPublisher() as publisher:
        yield publisher


def run(
    *,
    publisher_factory: Callable[[], AbstractContextManager[PikaPublisher]] = _publisher,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> None:
    delay = 1.0
    while True:
        try:
            with publisher_factory() as publisher:
                while True:
                    with session_factory() as session:
                        published = relay_once(session, publisher)
                    if published == 0:
                        time.sleep(IDLE_SECONDS)
        except (pika.exceptions.AMQPError, OSError, SQLAlchemyError) as exc:
            logger.warning("outbox relay unavailable (%s); retrying in %.1f seconds", exc, delay)
            time.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX_SECONDS)
        else:
            delay = 1.0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logger.info("fieldnote outbox relay started")
    try:
        run()
    except KeyboardInterrupt:
        logger.info("fieldnote outbox relay stopped")


if __name__ == "__main__":
    main()
