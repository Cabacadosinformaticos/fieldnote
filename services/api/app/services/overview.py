"""Counts and alerts for the study overview page.

Every read of participant data follows the same rule as the other researcher views: waiting,
declined and erasure-bound participants contribute no entries and no prompts. The counts that are
part of the overview itself (participants by state, pending approvals) do read those rows, because
the researcher has to see them; a participant with an erasure scheduled is left out entirely.
"""

import uuid
from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Activity, Entry, Participant, Prompt, Study
from app.models.enums import ParticipantStatus, PromptStatus
from app.services.entries_read import RESEARCHER_VISIBLE_STATUSES

LAST_ENTRIES_LIMIT = 10
NO_ENTRIES_DAYS = 2

_COUNTED_STATUSES = (
    ParticipantStatus.ACTIVE,
    ParticipantStatus.PENDING_APPROVAL,
    ParticipantStatus.DECLINED,
    ParticipantStatus.WITHDRAWN,
    ParticipantStatus.REMOVED,
)


def _timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _local_day_bounds(day: date, timezone: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=timezone).astimezone(UTC)
    end = (datetime.combine(day, time.min, tzinfo=timezone) + timedelta(days=1)).astimezone(UTC)
    return start, end


def _adherence(statuses: Counter) -> dict[str, object]:
    answered = statuses.get(PromptStatus.ANSWERED, 0)
    sent = statuses.get(PromptStatus.SENT, 0)
    expired = statuses.get(PromptStatus.EXPIRED, 0)
    planned = statuses.get(PromptStatus.PLANNED, 0)
    denominator = answered + sent + expired
    return {
        "answered": answered,
        "sent": sent,
        "expired": expired,
        "planned": planned,
        "percentage": round(answered * 100 / denominator, 1) if denominator else 0.0,
    }


def _prompt_statuses(
    session: Session,
    study_id: uuid.UUID,
    *,
    plan_date: date | None = None,
) -> Counter:
    statement = (
        select(Prompt.status, func.count())
        .join(Participant, Participant.id == Prompt.participant_id)
        .where(
            Participant.study_id == study_id,
            Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
            Prompt.status != PromptStatus.UNPLANNED,
        )
    )
    if plan_date is not None:
        statement = statement.where(Prompt.plan_date == plan_date)
    return Counter(dict(session.execute(statement.group_by(Prompt.status)).all()))


def _visible_entry_clause(study_id: uuid.UUID):
    return (
        Participant.study_id == study_id,
        Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
    )


def study_overview(session: Session, study_id: uuid.UUID) -> dict[str, object]:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")

    timezone = _timezone(study.timezone)
    now = datetime.now(UTC)
    today = now.astimezone(timezone).date()
    start, end = _local_day_bounds(today, timezone)

    status_counts = Counter(
        dict(
            session.execute(
                select(Participant.status, func.count())
                .where(Participant.study_id == study_id)
                .group_by(Participant.status)
            ).all()
        )
    )
    counts = {status: status_counts.get(status, 0) for status in _COUNTED_STATUSES}

    total_entries = session.scalar(
        select(func.count())
        .select_from(Entry)
        .join(Participant, Participant.id == Entry.participant_id)
        .where(*_visible_entry_clause(study_id))
    )
    today_rows = session.execute(
        select(
            Entry.prompt_id.is_(None),
            func.count(),
        )
        .select_from(Entry)
        .join(Participant, Participant.id == Entry.participant_id)
        .where(
            *_visible_entry_clause(study_id),
            Entry.recorded_at >= start,
            Entry.recorded_at < end,
        )
        .group_by(Entry.prompt_id.is_(None))
    ).all()
    today_final: dict[str, int] = {}
    for is_free, count in today_rows:
        today_final["free" if is_free else "answered"] = count
    today_entries = sum(today_final.values())

    last_rows = session.execute(
        select(Entry, Participant.alias, Activity.title)
        .join(Participant, Participant.id == Entry.participant_id)
        .outerjoin(Activity, Activity.id == Entry.activity_id)
        .where(*_visible_entry_clause(study_id))
        .order_by(Entry.recorded_at.desc(), Entry.id.desc())
        .limit(LAST_ENTRIES_LIMIT)
    ).all()
    last_entries = [
        {
            "id": entry.id,
            "participant_id": entry.participant_id,
            "participant_alias": alias,
            "activity_id": entry.activity_id,
            "activity_title": activity_title,
            "prompt_id": entry.prompt_id,
            "entry_type": entry.entry_type,
            "recorded_at": entry.recorded_at,
            "received_at": entry.received_at,
        }
        for entry, alias, activity_title in last_rows
    ]

    active_participants = list(
        session.scalars(
            select(Participant)
            .where(
                Participant.study_id == study_id,
                Participant.status == ParticipantStatus.ACTIVE,
            )
            .order_by(Participant.alias, Participant.id)
        )
    )
    last_by_participant: dict[uuid.UUID, datetime] = {}
    if active_participants:
        last_by_participant = dict(
            session.execute(
                select(Entry.participant_id, func.max(Entry.recorded_at))
                .where(
                    Entry.participant_id.in_(
                        [participant.id for participant in active_participants]
                    )
                )
                .group_by(Entry.participant_id)
            ).all()
        )

    alerts: list[dict[str, object]] = []
    pending = session.scalars(
        select(Participant)
        .where(
            Participant.study_id == study_id,
            Participant.status == ParticipantStatus.PENDING_APPROVAL,
        )
        .order_by(Participant.entered_at, Participant.id)
    )
    for participant in pending:
        alerts.append(
            {
                "kind": "pending_approval",
                "participant_id": participant.id,
                "alias": participant.alias,
                "entered_at": participant.entered_at,
            }
        )

    stale_before = now - timedelta(days=NO_ENTRIES_DAYS)
    for participant in active_participants:
        last_entry_at = last_by_participant.get(participant.id)
        if last_entry_at is None or last_entry_at < stale_before:
            alerts.append(
                {
                    "kind": "no_entries",
                    "participant_id": participant.id,
                    "alias": participant.alias,
                    "last_entry_at": last_entry_at,
                }
            )

    return {
        "study_id": study.id,
        "date": today,
        "timezone": study.timezone,
        "participants": {
            "total": sum(counts.values()),
            "active": counts[ParticipantStatus.ACTIVE],
            "pending_approval": counts[ParticipantStatus.PENDING_APPROVAL],
            "declined": counts[ParticipantStatus.DECLINED],
            "withdrawn": counts[ParticipantStatus.WITHDRAWN],
            "removed": counts[ParticipantStatus.REMOVED],
        },
        "entries": {
            "total": total_entries or 0,
            "today": today_entries,
            "today_answered": today_final.get("answered", 0),
            "today_free": today_final.get("free", 0),
        },
        "adherence_today": _adherence(_prompt_statuses(session, study_id, plan_date=today)),
        "adherence_study": _adherence(_prompt_statuses(session, study_id)),
        "last_entries": last_entries,
        "alerts": alerts,
    }
