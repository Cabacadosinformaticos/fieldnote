"""Outbox events written in the same transaction as the change they describe."""

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import MediaObject, OutboxEvent

ENTRY_CREATED_EVENT = "entry.created"
MEDIA_PROCESS_EVENT = "media.process"


def enqueue(session: Session, event_type: str, payload: dict[str, object]) -> OutboxEvent:
    event = OutboxEvent(event_type=event_type, payload=payload)
    session.add(event)
    return event


def enqueue_media_process(session: Session, media: MediaObject) -> OutboxEvent:
    return enqueue(
        session,
        MEDIA_PROCESS_EVENT,
        {
            "media_object_id": str(media.id),
            "object_key": media.object_key,
            "mime_type": media.mime_type,
        },
    )


def enqueue_entry_created(
    session: Session,
    *,
    entry_id: uuid.UUID,
    participant_id: uuid.UUID,
    study_id: uuid.UUID,
    entry_type: str,
    recorded_at: datetime,
    received_at: datetime,
) -> OutboxEvent:
    return enqueue(
        session,
        ENTRY_CREATED_EVENT,
        {
            "entry_id": str(entry_id),
            "participant_id": str(participant_id),
            "study_id": str(study_id),
            "entry_type": entry_type,
            "recorded_at": recorded_at.isoformat(),
            "received_at": received_at.isoformat(),
        },
    )
