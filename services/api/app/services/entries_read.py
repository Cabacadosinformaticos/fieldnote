"""Read models for the researcher views: entries, timeline and adherence.

Every query that serves a researcher filters on ``participant.status``. A participant waiting for
approval, declined or with an erasure scheduled has no data in any researcher view, and the
participant with an erasure scheduled disappears at once (data model, design notes).
"""

import base64
import hashlib
import hmac
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from urllib.parse import quote, urlencode, urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import ApiError
from app.models import (
    Activity,
    Entry,
    EntryTag,
    MediaObject,
    Participant,
    ParticipantIdentity,
    Prompt,
    Study,
    StudyAnswer,
    StudyQuestion,
    Tag,
    UserAccount,
)
from app.models.enums import EntryType, MediaStatus, ParticipantStatus, PromptStatus
from app.security.audit import record

RESEARCHER_VISIBLE_STATUSES = (
    ParticipantStatus.ACTIVE,
    ParticipantStatus.WITHDRAWN,
    ParticipantStatus.REMOVED,
)

SIGNED_URL_TTL_SECONDS = 600
"""NFR-40: signed media URLs are valid for 10 minutes and for one object."""

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200

ADHERENCE_STATES = ("answered", "expired", "sent_pending", "not_sent")

_SCALE_LABEL_KEYS = {
    "start": ("label_start", "start_label"),
    "middle": ("label_middle", "middle_label"),
    "end": ("label_end", "end_label"),
}


# ---------------------------------------------------------------------------------------------
# Signed GET URLs


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def presign_get_url(
    object_key: str, expires_in: int = SIGNED_URL_TTL_SECONDS
) -> tuple[str, datetime]:
    """Return an S3 SigV4 GET URL for one object and the moment it stops working.

    AWS Signature Version 4 with query-string credentials, as Garage expects. Only the ``host``
    header is signed, which is what a browser sends when the dashboard opens the URL.
    """
    endpoint = settings.s3_endpoint.rstrip("/")
    parsed = urlsplit(endpoint)
    bucket = quote(settings.s3_bucket, safe="-_.~")
    key = quote(object_key.lstrip("/"), safe="/-_.~")
    canonical_uri = f"{parsed.path.rstrip('/')}/{bucket}/{key}"
    host = parsed.netloc

    now = datetime.now(UTC)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    scope = f"{date_stamp}/{settings.s3_region}/s3/aws4_request"
    params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{settings.s3_access_key}/{scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": "host",
    }
    canonical_query = urlencode(sorted(params.items()), quote_via=quote)
    canonical_request = "\n".join(
        [
            "GET",
            canonical_uri,
            canonical_query,
            f"host:{host}\n",
            "host",
            "UNSIGNED-PAYLOAD",
        ]
    )
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    signing_key = _sign(
        _sign(
            _sign(_sign(f"AWS4{settings.s3_secret_key}".encode(), date_stamp), settings.s3_region),
            "s3",
        ),
        "aws4_request",
    )
    signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    url = f"{parsed.scheme}://{host}{canonical_uri}?{canonical_query}&X-Amz-Signature={signature}"
    return url, now + timedelta(seconds=expires_in)


# ---------------------------------------------------------------------------------------------
# Cursors


def encode_cursor(recorded_at: datetime, entry_id: uuid.UUID) -> str:
    raw = f"{recorded_at.isoformat()}|{entry_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> tuple[datetime, uuid.UUID]:
    try:
        padded = value + "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        timestamp, _, entry_id = raw.partition("|")
        return (_as_utc(datetime.fromisoformat(timestamp)), uuid.UUID(entry_id))
    except (ValueError, UnicodeDecodeError) as exc:
        raise ApiError(400, "invalid_cursor", "The cursor is invalid.") from exc


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


# ---------------------------------------------------------------------------------------------
# Entries


def _visible_participant_clause(study_id: uuid.UUID):
    return and_(
        Participant.study_id == study_id,
        Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
    )


def _entry_statement(study_id: uuid.UUID):
    return (
        select(Entry, Participant.alias, Activity.title)
        .join(Participant, Participant.id == Entry.participant_id)
        .outerjoin(Activity, Activity.id == Entry.activity_id)
        .where(_visible_participant_clause(study_id))
    )


def _tags_by_entry(
    session: Session, entry_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[dict[str, object]]]:
    if not entry_ids:
        return {}
    rows = session.execute(
        select(EntryTag.entry_id, Tag.id, Tag.name)
        .join(Tag, Tag.id == EntryTag.tag_id)
        .where(EntryTag.entry_id.in_(entry_ids))
        .order_by(Tag.name)
    ).all()
    grouped: dict[uuid.UUID, list[dict[str, object]]] = defaultdict(list)
    for entry_id, tag_id, name in rows:
        grouped[entry_id].append({"id": tag_id, "name": name})
    return grouped


def _media_by_entry(
    session: Session, entry_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[MediaObject]]:
    if not entry_ids:
        return {}
    rows = session.scalars(
        select(MediaObject)
        .where(MediaObject.entry_id.in_(entry_ids))
        .order_by(MediaObject.created_at, MediaObject.id)
    ).all()
    grouped: dict[uuid.UUID, list[MediaObject]] = defaultdict(list)
    for media in rows:
        if media.entry_id is not None:
            grouped[media.entry_id].append(media)
    return grouped


def _entry_dict(
    entry: Entry,
    alias: str | None,
    activity_title: str | None,
    tags: list[dict[str, object]],
    media: list[MediaObject],
    *,
    urls: dict[uuid.UUID, tuple[str, datetime]] | None = None,
) -> dict[str, object]:
    urls = urls or {}
    return {
        "id": entry.id,
        "participant_id": entry.participant_id,
        "participant_alias": alias,
        "activity_id": entry.activity_id,
        "activity_title": activity_title,
        "prompt_id": entry.prompt_id,
        "entry_type": entry.entry_type,
        "body": entry.body,
        "value": entry.value,
        "scale_shown": entry.scale_shown,
        "choice": entry.choice,
        "latitude": entry.latitude,
        "longitude": entry.longitude,
        "recorded_at": entry.recorded_at,
        "received_at": entry.received_at,
        "tags": tags,
        "media": [
            {
                "id": item.id,
                "mime_type": item.mime_type,
                "size_bytes": item.size_bytes,
                "status": item.status,
                "url": urls[item.id][0] if item.id in urls else None,
                "url_expires_at": urls[item.id][1] if item.id in urls else None,
            }
            for item in media
        ],
    }


def list_entries(
    session: Session,
    study_id: uuid.UUID,
    *,
    participant_id: uuid.UUID | None = None,
    activity_id: uuid.UUID | None = None,
    entry_type: EntryType | None = None,
    tag_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    cursor: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
) -> dict[str, object]:
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    statement = _entry_statement(study_id)

    if participant_id is not None:
        statement = statement.where(Entry.participant_id == participant_id)
    if activity_id is not None:
        statement = statement.where(Entry.activity_id == activity_id)
    if entry_type is not None:
        statement = statement.where(Entry.entry_type == entry_type)
    if tag_id is not None:
        statement = statement.where(
            Entry.id.in_(
                select(EntryTag.entry_id)
                .join(Tag, Tag.id == EntryTag.tag_id)
                .where(Tag.study_id == study_id, Tag.id == tag_id)
            )
        )
    if date_from is not None:
        statement = statement.where(Entry.recorded_at >= _as_utc(date_from))
    if date_to is not None:
        statement = statement.where(Entry.recorded_at <= _as_utc(date_to))
    if cursor is not None:
        cursor_at, cursor_id = decode_cursor(cursor)
        statement = statement.where(
            or_(
                Entry.recorded_at < cursor_at,
                and_(Entry.recorded_at == cursor_at, Entry.id < cursor_id),
            )
        )

    statement = statement.order_by(Entry.recorded_at.desc(), Entry.id.desc()).limit(limit + 1)
    rows = session.execute(statement).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    entry_ids = [row[0].id for row in rows]
    tags = _tags_by_entry(session, entry_ids)
    media = _media_by_entry(session, entry_ids)

    items = [
        _entry_dict(
            entry,
            alias,
            activity_title,
            tags.get(entry.id, []),
            media.get(entry.id, []),
        )
        for entry, alias, activity_title in rows
    ]
    next_cursor = None
    if has_more and rows:
        last = rows[-1][0]
        next_cursor = encode_cursor(last.recorded_at, last.id)
    return {"items": items, "next_cursor": next_cursor}


def get_entry(
    session: Session,
    study_id: uuid.UUID,
    entry_id: uuid.UUID,
    user: UserAccount,
) -> dict[str, object]:
    row = session.execute(_entry_statement(study_id).where(Entry.id == entry_id)).one_or_none()
    if row is None:
        raise ApiError(404, "not_found", "The entry was not found.")

    entry, alias, activity_title = row
    tags = _tags_by_entry(session, [entry.id])
    media = _media_by_entry(session, [entry.id])

    urls: dict[uuid.UUID, tuple[str, datetime]] = {}
    for item in media.get(entry.id, []):
        if item.status != MediaStatus.PROCESSED:
            # Until processing succeeds the original is not offered for download or export
            # (security.md, Media files).
            continue
        url, expires_at = presign_get_url(item.object_key)
        urls[item.id] = (url, expires_at)
        record(
            session,
            user,
            "media_url_issued",
            target=str(item.id),
            details={
                "study_id": str(study_id),
                "entry_id": str(entry.id),
                "object_key": item.object_key,
            },
        )
    if urls:
        session.commit()

    return _entry_dict(
        entry,
        alias,
        activity_title,
        tags.get(entry.id, []),
        media.get(entry.id, []),
        urls=urls,
    )


# ---------------------------------------------------------------------------------------------
# Timeline


def _timeline_entry(entry: Entry, tag_ids: list[uuid.UUID], media_count: int) -> dict[str, object]:
    return {
        "id": entry.id,
        "participant_id": entry.participant_id,
        "activity_id": entry.activity_id,
        "prompt_id": entry.prompt_id,
        "entry_type": entry.entry_type,
        "recorded_at": entry.recorded_at,
        "tag_ids": tag_ids,
        "media_count": media_count,
    }


def timeline(
    session: Session,
    study_id: uuid.UUID,
    *,
    participant_id: uuid.UUID | None = None,
    activity_id: uuid.UUID | None = None,
    entry_type: EntryType | None = None,
    tag_id: uuid.UUID | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    zoom: str = "day",
) -> dict[str, object]:
    end = _as_utc(end) if end is not None else datetime.now(UTC)
    start = _as_utc(start) if start is not None else end - timedelta(days=7)
    if start >= end:
        raise ApiError(400, "invalid_range", "The start of the timeline must be before the end.")

    participant_statement = (
        select(Participant)
        .where(_visible_participant_clause(study_id))
        .order_by(Participant.alias, Participant.id)
    )
    if participant_id is not None:
        participant_statement = participant_statement.where(Participant.id == participant_id)
    participants = session.scalars(participant_statement).all()
    lanes = {
        item.id: {"participant_id": item.id, "alias": item.alias, "entries": [], "markers": []}
        for item in participants
    }

    entry_statement = _entry_statement(study_id).where(
        Entry.recorded_at >= start, Entry.recorded_at <= end
    )
    if participant_id is not None:
        entry_statement = entry_statement.where(Entry.participant_id == participant_id)
    if activity_id is not None:
        entry_statement = entry_statement.where(Entry.activity_id == activity_id)
    if entry_type is not None:
        entry_statement = entry_statement.where(Entry.entry_type == entry_type)
    if tag_id is not None:
        entry_statement = entry_statement.where(
            Entry.id.in_(
                select(EntryTag.entry_id)
                .join(Tag, Tag.id == EntryTag.tag_id)
                .where(Tag.study_id == study_id, Tag.id == tag_id)
            )
        )
    entry_rows = session.execute(entry_statement.order_by(Entry.recorded_at, Entry.id)).all()

    entry_ids = [row[0].id for row in entry_rows]
    tag_rows = _tags_by_entry(session, entry_ids)
    media_rows = _media_by_entry(session, entry_ids)
    for entry, _alias, _title in entry_rows:
        lane = lanes.get(entry.participant_id)
        if lane is None:
            continue
        lane["entries"].append(
            _timeline_entry(
                entry,
                [tag["id"] for tag in tag_rows.get(entry.id, [])],
                len(media_rows.get(entry.id, [])),
            )
        )

    # A request missed or expired is a hollow marker in the lane of its participant (FR-113).
    prompt_statement = select(Prompt).where(
        Prompt.participant_id.in_(list(lanes)),
        Prompt.status == PromptStatus.EXPIRED,
    )
    if participant_id is not None:
        prompt_statement = prompt_statement.where(Prompt.participant_id == participant_id)
    if activity_id is not None:
        prompt_statement = prompt_statement.where(Prompt.activity_id == activity_id)
    for prompt in session.scalars(prompt_statement.order_by(Prompt.plan_date, Prompt.occurrence)):
        lane = lanes.get(prompt.participant_id)
        if lane is None:
            continue
        placed_at = prompt.scheduled_at or prompt.sent_at
        if placed_at is not None and not (start <= _as_utc(placed_at) <= end):
            continue
        lane["markers"].append(
            {
                "prompt_id": prompt.id,
                "activity_id": prompt.activity_id,
                "status": prompt.status,
                "scheduled_at": prompt.scheduled_at,
                "sent_at": prompt.sent_at,
                "hollow": True,
            }
        )

    return {
        "zoom": zoom,
        "start": start,
        "end": end,
        "lanes": list(lanes.values()),
    }


# ---------------------------------------------------------------------------------------------
# Adherence


def _study_days(study: Study, prompts: list[Prompt]) -> list[date]:
    if study.starts_on is not None and study.ends_on is not None:
        days = []
        current = study.starts_on
        while current <= study.ends_on:
            days.append(current)
            current += timedelta(days=1)
        return days
    dates = sorted({prompt.plan_date for prompt in prompts})
    if dates:
        days = []
        current = dates[0]
        while current <= dates[-1]:
            days.append(current)
            current += timedelta(days=1)
        return days
    return []


def _cell_state(prompts: list[Prompt]) -> str:
    statuses = {prompt.status for prompt in prompts}
    if PromptStatus.ANSWERED in statuses:
        return "answered"
    if PromptStatus.SENT in statuses:
        return "sent_pending"
    if PromptStatus.EXPIRED in statuses:
        return "expired"
    return "not_sent"


def adherence(
    session: Session, study_id: uuid.UUID, participant_id: uuid.UUID
) -> dict[str, object]:
    participant = session.get(Participant, participant_id)
    if (
        participant is None
        or participant.study_id != study_id
        or participant.status not in RESEARCHER_VISIBLE_STATUSES
    ):
        raise ApiError(404, "not_found", "The participant was not found.")

    study = session.get(Study, study_id)
    prompts = list(
        session.scalars(
            select(Prompt)
            .where(
                Prompt.participant_id == participant_id,
                Prompt.status != PromptStatus.UNPLANNED,
            )
            .order_by(Prompt.plan_date, Prompt.occurrence)
        ).all()
    )
    days = _study_days(study, prompts)
    slots = sorted({prompt.occurrence for prompt in prompts})

    entries = session.scalars(
        select(Entry).where(
            Entry.participant_id == participant_id,
            Entry.prompt_id.is_(None),
        )
    ).all()
    try:
        timezone = ZoneInfo(study.timezone)
    except ZoneInfoNotFoundError:
        timezone = UTC
    free_by_day: dict[date, int] = defaultdict(int)
    for entry in entries:
        free_by_day[_as_utc(entry.recorded_at).astimezone(timezone).date()] += 1

    by_day_slot: dict[tuple[date, int], list[Prompt]] = defaultdict(list)
    for prompt in prompts:
        by_day_slot[(prompt.plan_date, prompt.occurrence)].append(prompt)

    day_rows = []
    for day in days:
        cells = []
        for slot in slots:
            cell_prompts = by_day_slot.get((day, slot), [])
            if not cell_prompts:
                continue
            cells.append(
                {
                    "occurrence": slot,
                    "state": _cell_state(cell_prompts),
                    "prompts": [
                        {
                            "prompt_id": prompt.id,
                            "activity_id": prompt.activity_id,
                            "status": prompt.status,
                            "scheduled_at": prompt.scheduled_at,
                            "sent_at": prompt.sent_at,
                            "shown_at": prompt.shown_at,
                            "opened_at": prompt.opened_at,
                        }
                        for prompt in cell_prompts
                    ],
                }
            )
        day_rows.append({"date": day, "cells": cells, "free_entries": free_by_day.get(day, 0)})

    answered = sum(1 for prompt in prompts if prompt.status == PromptStatus.ANSWERED)
    expired = sum(1 for prompt in prompts if prompt.status == PromptStatus.EXPIRED)
    sent_pending = sum(1 for prompt in prompts if prompt.status == PromptStatus.SENT)
    not_sent = sum(1 for prompt in prompts if prompt.status == PromptStatus.PLANNED)
    denominator = answered + expired + sent_pending
    percentage = round(answered * 100 / denominator, 1) if denominator else 0.0

    return {
        "participant": {"id": participant.id, "alias": participant.alias},
        "days": day_rows,
        "slots": slots,
        "states": list(ADHERENCE_STATES),
        "summary": {
            "answered": answered,
            "expired": expired,
            "sent_pending": sent_pending,
            "not_sent": not_sent,
            "denominator": denominator,
            "percentage": percentage,
        },
    }


# ---------------------------------------------------------------------------------------------
# Export helpers shared with services/export.py


def scale_labels(scale_shown: dict[str, object] | None) -> dict[str, str]:
    """Return the label texts of a stored scale copy, tolerating the key spellings in use."""
    if not scale_shown:
        return {"start": "", "middle": "", "end": ""}
    labels = scale_shown.get("labels")
    if isinstance(labels, list):
        texts = [str(item) for item in labels]
        return {
            "start": texts[0] if texts else "",
            "middle": texts[1] if len(texts) > 2 else "",
            "end": texts[-1] if len(texts) > 1 else "",
        }
    return {
        name: next(
            (str(scale_shown[key]) for key in keys if scale_shown.get(key) is not None),
            "",
        )
        for name, keys in _SCALE_LABEL_KEYS.items()
    }


def identity_rows(
    session: Session, participant_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict[str, str]]:
    if not participant_ids:
        return {}
    rows = session.scalars(
        select(ParticipantIdentity).where(ParticipantIdentity.participant_id.in_(participant_ids))
    ).all()
    return {row.participant_id: {"name": row.name or "", "email": row.email or ""} for row in rows}


def study_answer_rows(
    session: Session, study_id: uuid.UUID
) -> list[tuple[StudyAnswer, str | None, StudyQuestion | None]]:
    rows = session.execute(
        select(StudyAnswer, Participant.alias, StudyQuestion)
        .join(Participant, Participant.id == StudyAnswer.participant_id)
        .outerjoin(StudyQuestion, StudyQuestion.id == StudyAnswer.question_id)
        .where(_visible_participant_clause(study_id))
        .order_by(Participant.alias, StudyAnswer.answered_at, StudyAnswer.id)
    ).all()
    return [(answer, alias, question) for answer, alias, question in rows]
