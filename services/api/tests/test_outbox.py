import json
from datetime import UTC, datetime

import pika
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import OutboxEvent
from app.outbox_relay import EVENTS_EXCHANGE, MEDIA_QUEUE, PikaPublisher, relay_once
from app.services.outbox import ENTRY_CREATED_EVENT, MEDIA_PROCESS_EVENT


class FakePublisher:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def publish(self, event_type: str, payload: dict[str, object]) -> None:
        self.calls.append((event_type, payload))


class FailingPublisher:
    def publish(self, event_type: str, payload: dict[str, object]) -> None:
        raise RuntimeError("broker unavailable")


def _add_event(
    session: Session,
    event_type: str,
    payload: dict[str, object],
    *,
    published: bool = False,
) -> OutboxEvent:
    event = OutboxEvent(
        event_type=event_type,
        payload=payload,
        published_at=datetime.now(UTC) if published else None,
    )
    session.add(event)
    session.commit()
    return event


def test_relay_publishes_and_marks_the_batch(session: Session) -> None:
    media = _add_event(
        session,
        MEDIA_PROCESS_EVENT,
        {
            "media_object_id": "2f1c4a3e-7b1e-4b8f-9d2a-6c5e8f0a1b3c",
            "object_key": "entries/p/e/m",
            "mime_type": "image/jpeg",
        },
    )
    created = _add_event(
        session,
        ENTRY_CREATED_EVENT,
        {"entry_id": "4a3e2f1c-1b7e-4b8f-9d2a-6c5e8f0a1b3c"},
    )
    publisher = FakePublisher()

    published = relay_once(session, publisher)

    assert published == 2
    assert publisher.calls == [
        (media.event_type, media.payload),
        (created.event_type, created.payload),
    ]
    rows = session.scalars(select(OutboxEvent).order_by(OutboxEvent.id)).all()
    assert all(row.published_at is not None for row in rows)


def test_relay_skips_events_that_are_already_published(session: Session) -> None:
    _add_event(session, ENTRY_CREATED_EVENT, {"entry_id": "already"}, published=True)
    pending = _add_event(session, ENTRY_CREATED_EVENT, {"entry_id": "pending"})
    publisher = FakePublisher()

    published = relay_once(session, publisher)

    assert published == 1
    assert publisher.calls == [(pending.event_type, pending.payload)]


def test_relay_keeps_events_unpublished_when_publishing_fails(session: Session) -> None:
    event = _add_event(session, MEDIA_PROCESS_EVENT, {"media_object_id": "m"})

    with pytest.raises(RuntimeError):
        relay_once(session, FailingPublisher())

    session.rollback()
    row = session.get(OutboxEvent, event.id)
    assert row is not None
    assert row.published_at is None


def test_relay_does_nothing_when_the_outbox_is_empty(session: Session) -> None:
    publisher = FakePublisher()

    assert relay_once(session, publisher) == 0
    assert publisher.calls == []


def test_pika_publisher_routes_media_jobs_and_dashboard_events() -> None:
    class FakeChannel:
        def __init__(self) -> None:
            self.published: list[dict[str, object]] = []

        def basic_publish(self, **kwargs: object) -> None:
            self.published.append(kwargs)

    channel = FakeChannel()
    publisher = PikaPublisher.__new__(PikaPublisher)
    publisher._channel = channel

    media_payload = {
        "media_object_id": "2f1c4a3e-7b1e-4b8f-9d2a-6c5e8f0a1b3c",
        "object_key": "entries/p/e/m",
        "mime_type": "image/jpeg",
    }
    publisher.publish(MEDIA_PROCESS_EVENT, media_payload)
    publisher.publish(ENTRY_CREATED_EVENT, {"entry_id": "an-entry"})

    media_call, event_call = channel.published
    assert media_call["exchange"] == ""
    assert media_call["routing_key"] == MEDIA_QUEUE
    assert media_call["mandatory"] is True
    assert json.loads(media_call["body"]) == media_payload
    properties = media_call["properties"]
    assert isinstance(properties, pika.BasicProperties)
    assert properties.delivery_mode == 2
    assert properties.content_type == "application/json"

    assert event_call["exchange"] == EVENTS_EXCHANGE
    assert event_call["routing_key"] == ENTRY_CREATED_EVENT
    assert json.loads(event_call["body"]) == {"entry_id": "an-entry"}
