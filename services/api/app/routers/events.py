"""Server-sent events for the study dashboard (FR-31, NFR-32).

The prototype has no broker, so the stream polls the database every second. The events only say
what changed; the dashboard reads the data from the REST API. A comment line every 20 seconds
keeps idle connections open, and the response is not cached and not compressed.
"""

import json
import time
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Entry, Participant
from app.models.enums import ParticipantStatus
from app.security.deps import StudyAccess, require_study_role
from app.services.entries_read import RESEARCHER_VISIBLE_STATUSES

router = APIRouter(prefix="/studies/{study_id}", tags=["events"])

POLL_INTERVAL_SECONDS = 1.0
COMMENT_INTERVAL_SECONDS = 20.0
BATCH_SIZE = 200

study_member = require_study_role()


def _sse(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _participant_rows(session: Session, study_id: uuid.UUID):
    return session.execute(
        select(
            Participant.id,
            Participant.alias,
            Participant.status,
            Participant.entered_at,
            Participant.erasure_due_at,
        )
        .where(Participant.study_id == study_id)
        .order_by(Participant.id)
    ).all()


def _participant_payload(row) -> dict[str, object]:
    return {
        "participant_id": row.id,
        "alias": row.alias,
        "status": row.status,
        "erasure_due_at": row.erasure_due_at,
    }


def _participant_changes(
    session: Session,
    study_id: uuid.UUID,
    previous: dict[uuid.UUID, ParticipantStatus],
) -> tuple[list[tuple[str, dict[str, object]]], dict[uuid.UUID, ParticipantStatus]]:
    """Compare the current statuses with the last snapshot."""
    rows = _participant_rows(session, study_id)
    current = {row.id: row.status for row in rows}
    events: list[tuple[str, dict[str, object]]] = []
    for row in rows:
        if row.id not in previous:
            events.append(("participant.created", _participant_payload(row)))
        elif previous[row.id] != row.status:
            events.append(("participant.updated", _participant_payload(row)))
    return events, current


def _entries_after(
    session: Session,
    study_id: uuid.UUID,
    received_at: datetime,
    entry_id: uuid.UUID,
):
    return session.execute(
        select(
            Entry.id,
            Entry.participant_id,
            Entry.recorded_at,
            Entry.received_at,
        )
        .join(Participant, Participant.id == Entry.participant_id)
        .where(
            Participant.study_id == study_id,
            Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
            or_(
                Entry.received_at > received_at,
                and_(Entry.received_at == received_at, Entry.id > entry_id),
            ),
        )
        .order_by(Entry.received_at, Entry.id)
        .limit(BATCH_SIZE)
    ).all()


def _event_stream(session: Session, study_id: uuid.UUID, since: datetime | None) -> Iterator[str]:
    if since is not None:
        since = _as_utc(since)
    session.rollback()

    initial = _participant_rows(session, study_id)
    previous = {row.id: row.status for row in initial}
    yield ": connected\n\n"
    if since is not None:
        for row in initial:
            if row.entered_at is not None and _as_utc(row.entered_at) > since:
                yield _sse("participant.created", _participant_payload(row))

    cursor_at = since if since is not None else datetime.now(UTC)
    cursor_id = uuid.UUID(int=0)
    last_comment = time.monotonic()

    while True:
        time.sleep(POLL_INTERVAL_SECONDS)
        session.expire_all()

        entries = _entries_after(session, study_id, cursor_at, cursor_id)
        for entry in entries:
            yield _sse(
                "entry.created",
                {
                    "entry_id": entry.id,
                    "participant_id": entry.participant_id,
                    "recorded_at": entry.recorded_at,
                    "received_at": entry.received_at,
                },
            )
        if entries:
            cursor_at = entries[-1].received_at
            cursor_id = entries[-1].id

        changes, previous = _participant_changes(session, study_id, previous)
        for event, payload in changes:
            yield _sse(event, payload)

        session.rollback()
        if time.monotonic() - last_comment >= COMMENT_INTERVAL_SECONDS:
            yield ": keep-alive\n\n"
            last_comment = time.monotonic()


@router.get("/events")
def events(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
    since: Annotated[datetime | None, Query()] = None,
) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(session, study_id, since),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
