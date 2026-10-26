"""Every SQL statement of the scheduler service.

The pure planner never touches PostgreSQL; this module is the only place with SQL and the only
place that knows the table and column names of the API schema. Connections are in autocommit
mode, and multi-statement operations open an explicit transaction.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time
from uuid import UUID

import psycopg
from psycopg import Connection

from .model import DayPlan
from .settings import Settings


@dataclass(frozen=True)
class StudyRow:
    id: UUID
    status: str
    timezone: str
    max_prompts_per_day: int
    max_prompts_per_slot: int
    schedule_style: str
    starts_on: date | None
    ends_on: date | None


@dataclass(frozen=True)
class ActivityRow:
    id: UUID
    study_id: UUID
    prompts_per_day: int
    min_gap_minutes: int
    window_start: time
    window_end: time


@dataclass(frozen=True)
class ParticipantRow:
    id: UUID
    study_id: UUID
    availability_any_time: bool
    push_token: str | None
    locale: str | None


@dataclass(frozen=True)
class AvailabilityRow:
    participant_id: UUID
    start_time: time
    end_time: time
    weekdays: Sequence[int]


@dataclass(frozen=True)
class AvailabilityStateRow:
    participant_id: UUID
    any_time: bool
    start_time: time | None
    end_time: time | None
    weekdays: Sequence[int] | None


@dataclass(frozen=True)
class HistoryPromptRow:
    participant_id: UUID
    activity_id: UUID
    occurrence: int
    scheduled_at: datetime
    plan_date: date


@dataclass(frozen=True)
class PromptRow:
    id: UUID
    participant_id: UUID
    activity_id: UUID
    plan_date: date
    occurrence: int
    scheduled_at: datetime | None
    status: str


@dataclass(frozen=True)
class DuePromptRow:
    id: UUID
    participant_id: UUID
    push_token: str
    locale: str | None
    scheduled_at: datetime


@dataclass(frozen=True)
class LeaseRow:
    holder: str | None
    expires_at: datetime | None


def connect(settings: Settings) -> Connection:
    return psycopg.connect(
        settings.libpq_database_url,
        autocommit=True,
        connect_timeout=settings.database_connect_timeout_seconds,
    )


# Studies, activities, participants and availability


def load_running_studies(conn: Connection) -> list[StudyRow]:
    rows = conn.execute(
        """
        SELECT id, status, timezone, max_prompts_per_day, max_prompts_per_slot,
               schedule_style, starts_on, ends_on
        FROM study
        WHERE status = 'running'
        ORDER BY id
        """
    ).fetchall()
    return [StudyRow(*row) for row in rows]


def load_study(conn: Connection, study_id: UUID) -> StudyRow | None:
    row = conn.execute(
        """
        SELECT id, status, timezone, max_prompts_per_day, max_prompts_per_slot,
               schedule_style, starts_on, ends_on
        FROM study
        WHERE id = %s
        """,
        (study_id,),
    ).fetchone()
    return StudyRow(*row) if row is not None else None


def load_activities(conn: Connection, study_id: UUID) -> list[ActivityRow]:
    rows = conn.execute(
        """
        SELECT id, study_id, prompts_per_day, min_gap_minutes, window_start, window_end
        FROM activity
        WHERE study_id = %s
        ORDER BY id
        """,
        (study_id,),
    ).fetchall()
    return [ActivityRow(*row) for row in rows]


def load_active_participants(conn: Connection, study_id: UUID) -> list[ParticipantRow]:
    rows = conn.execute(
        """
        SELECT id, study_id, availability_any_time, push_token, locale
        FROM participant
        WHERE study_id = %s AND status = 'active'
        ORDER BY id
        """,
        (study_id,),
    ).fetchall()
    return [ParticipantRow(*row) for row in rows]


def load_availability(conn: Connection, participant_ids: Iterable[UUID]) -> list[AvailabilityRow]:
    ids = list(participant_ids)
    if not ids:
        return []
    rows = conn.execute(
        """
        SELECT participant_id, start_time, end_time, weekdays
        FROM availability
        WHERE participant_id = ANY(%s)
        ORDER BY participant_id, start_time, end_time, id
        """,
        (ids,),
    ).fetchall()
    return [AvailabilityRow(*row) for row in rows]


def load_availability_state(conn: Connection, study_id: UUID) -> list[AvailabilityStateRow]:
    """The availability of every active participant, for the change marker."""
    rows = conn.execute(
        """
        SELECT p.id, p.availability_any_time, a.start_time, a.end_time, a.weekdays
        FROM participant p
        LEFT JOIN availability a ON a.participant_id = p.id
        WHERE p.study_id = %s AND p.status = 'active'
        ORDER BY p.id, a.start_time, a.end_time, a.id
        """,
        (study_id,),
    ).fetchall()
    return [AvailabilityStateRow(*row) for row in rows]


# Plans, prompts and history


def load_planned_dates(conn: Connection, study_id: UUID, dates: Sequence[date]) -> set[date]:
    if not dates:
        return set()
    rows = conn.execute(
        """
        SELECT DISTINCT plan_date
        FROM plan_run
        WHERE study_id = %s AND plan_date = ANY(%s)
        """,
        (study_id, list(dates)),
    ).fetchall()
    return {row[0] for row in rows}


def has_plan(conn: Connection, study_id: UUID, plan_date: date) -> bool:
    row = conn.execute(
        """
        SELECT EXISTS(
            SELECT 1 FROM plan_run WHERE study_id = %s AND plan_date = %s
        )
        """,
        (study_id, plan_date),
    ).fetchone()
    return bool(row and row[0])


def load_history(
    conn: Connection, participant_ids: Iterable[UUID], start: date, end: date
) -> list[HistoryPromptRow]:
    ids = list(participant_ids)
    if not ids or start > end:
        return []
    rows = conn.execute(
        """
        SELECT participant_id, activity_id, occurrence, scheduled_at, plan_date
        FROM prompt
        WHERE participant_id = ANY(%s)
          AND plan_date BETWEEN %s AND %s
          AND scheduled_at IS NOT NULL
          AND status <> 'unplanned'
        ORDER BY scheduled_at, id
        """,
        (ids, start, end),
    ).fetchall()
    return [HistoryPromptRow(*row) for row in rows]


def load_prompts_on(
    conn: Connection, participant_ids: Iterable[UUID], plan_date: date
) -> list[PromptRow]:
    ids = list(participant_ids)
    if not ids:
        return []
    rows = conn.execute(
        """
        SELECT id, participant_id, activity_id, plan_date, occurrence, scheduled_at, status
        FROM prompt
        WHERE participant_id = ANY(%s) AND plan_date = %s
        ORDER BY participant_id, activity_id, occurrence
        """,
        (ids, plan_date),
    ).fetchall()
    return [PromptRow(*row) for row in rows]


def write_plan(
    conn: Connection,
    study_id: UUID,
    plan: DayPlan,
    *,
    skip_keys: Iterable[tuple[str, str, int]] = (),
) -> None:
    """Store one plan and its run record in one transaction.

    The unique key on (participant, activity, plan date, occurrence) makes the write idempotent.
    A prompt that is already sent, answered or expired is never overwritten.
    """
    skipped = set(skip_keys)
    insert = """
        INSERT INTO prompt
            (id, activity_id, participant_id, plan_date, occurrence, scheduled_at, status,
             unplanned_reason)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (participant_id, activity_id, plan_date, occurrence)
        DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at,
                      status = EXCLUDED.status,
                      unplanned_reason = EXCLUDED.unplanned_reason
        WHERE prompt.status IN ('planned', 'unplanned')
    """
    planned = 0
    params: list[tuple[object, ...]] = []
    for prompt in plan.planned:
        key = (prompt.participant_id, prompt.activity_id, prompt.occurrence)
        if key in skipped:
            continue
        planned += 1
        params.append(
            (
                uuid.uuid4(),
                UUID(prompt.activity_id),
                UUID(prompt.participant_id),
                plan.plan_date,
                prompt.occurrence,
                prompt.scheduled_at,
                "planned",
                None,
            )
        )
    for prompt in plan.unplanned:
        key = (prompt.participant_id, prompt.activity_id, prompt.occurrence)
        if key in skipped:
            continue
        params.append(
            (
                uuid.uuid4(),
                UUID(prompt.activity_id),
                UUID(prompt.participant_id),
                plan.plan_date,
                prompt.occurrence,
                None,
                "unplanned",
                prompt.reason.value,
            )
        )

    with conn.transaction():
        if params:
            with conn.cursor() as cursor:
                cursor.executemany(insert, params)
        insert_plan_run(
            conn,
            study_id=study_id,
            plan=plan,
            planned=planned,
            unplanned=len(plan.unplanned),
        )


def insert_plan_run(
    conn: Connection, *, study_id: UUID, plan: DayPlan, planned: int, unplanned: int
) -> None:
    conn.execute(
        """
        INSERT INTO plan_run
            (id, study_id, plan_date, finished, nodes_expanded, planned, unplanned, solve_ms)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            uuid.uuid4(),
            study_id,
            plan.plan_date,
            plan.finished,
            plan.nodes_expanded,
            planned,
            unplanned,
            plan.solve_ms,
        ),
    )


# Sending and expiry


def load_due_prompts(conn: Connection, at: datetime, limit: int) -> list[DuePromptRow]:
    rows = conn.execute(
        """
        SELECT p.id, p.participant_id, pt.push_token, pt.locale, p.scheduled_at
        FROM prompt p
        JOIN participant pt ON pt.id = p.participant_id
        JOIN study s ON s.id = pt.study_id
        WHERE p.status = 'planned'
          AND p.scheduled_at IS NOT NULL
          AND p.scheduled_at <= %s
          AND p.plan_date = (%s AT TIME ZONE s.timezone)::date
          AND s.status = 'running'
          AND pt.status = 'active'
          AND pt.push_token IS NOT NULL
        ORDER BY p.scheduled_at, p.id
        LIMIT %s
        """,
        (at, at, limit),
    ).fetchall()
    return [DuePromptRow(*row) for row in rows]


def mark_sent_if_leader(conn: Connection, prompt_id: UUID, lease_name: str, holder: str) -> bool:
    """Mark a prompt sent only while this replica still holds the lease.

    The status change and the lease check are one statement, so a standby that took over cannot
    send a prompt the old leader also marked (scheduler.md: running with two replicas).
    """
    cursor = conn.execute(
        """
        UPDATE prompt p
        SET status = 'sent', sent_at = now()
        WHERE p.id = %s
          AND p.status = 'planned'
          AND EXISTS (
              SELECT 1 FROM leader_lease l
              WHERE l.name = %s AND l.holder = %s AND l.expires_at > now()
          )
          AND EXISTS (
              SELECT 1
              FROM participant pt
              JOIN study s ON s.id = pt.study_id
              WHERE pt.id = p.participant_id
                AND pt.status = 'active'
                AND s.status = 'running'
          )
        """,
        (prompt_id, lease_name, holder),
    )
    return cursor.rowcount == 1


def expire_prompts(conn: Connection, at: datetime) -> int:
    cursor = conn.execute(
        """
        UPDATE prompt p
        SET status = 'expired'
        FROM activity a
        JOIN study s ON s.id = a.study_id
        WHERE p.activity_id = a.id
          AND p.status IN ('planned', 'sent')
          AND p.scheduled_at IS NOT NULL
          AND (
              p.plan_date < (%s AT TIME ZONE s.timezone)::date
              OR (
                  p.plan_date = (%s AT TIME ZONE s.timezone)::date
                  AND (%s AT TIME ZONE s.timezone)::time >= a.window_end
              )
          )
        """,
        (at, at, at),
    )
    return cursor.rowcount


# Leader lease


def acquire_lease(conn: Connection, name: str, holder: str, ttl_seconds: int) -> LeaseRow | None:
    row = conn.execute(
        """
        INSERT INTO leader_lease (name, holder, expires_at)
        VALUES (%s, %s, now() + make_interval(secs => %s))
        ON CONFLICT (name) DO UPDATE
        SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
        WHERE leader_lease.holder = EXCLUDED.holder
           OR leader_lease.expires_at IS NULL
           OR leader_lease.expires_at <= now()
        RETURNING holder, expires_at
        """,
        (name, holder, ttl_seconds),
    ).fetchone()
    return LeaseRow(*row) if row is not None else None


def renew_lease(conn: Connection, name: str, holder: str, ttl_seconds: int) -> LeaseRow | None:
    row = conn.execute(
        """
        UPDATE leader_lease
        SET expires_at = now() + make_interval(secs => %s)
        WHERE name = %s AND holder = %s
        RETURNING holder, expires_at
        """,
        (ttl_seconds, name, holder),
    ).fetchone()
    return LeaseRow(*row) if row is not None else None


def release_lease(conn: Connection, name: str, holder: str) -> None:
    conn.execute(
        """
        UPDATE leader_lease
        SET expires_at = now()
        WHERE name = %s AND holder = %s
        """,
        (name, holder),
    )


def lease_is_held(conn: Connection, name: str, holder: str) -> bool:
    row = conn.execute(
        """
        SELECT EXISTS(
            SELECT 1 FROM leader_lease
            WHERE name = %s AND holder = %s AND expires_at > now()
        )
        """,
        (name, holder),
    ).fetchone()
    return bool(row and row[0])


__all__ = [
    "ActivityRow",
    "AvailabilityRow",
    "AvailabilityStateRow",
    "DuePromptRow",
    "HistoryPromptRow",
    "LeaseRow",
    "ParticipantRow",
    "PromptRow",
    "StudyRow",
    "acquire_lease",
    "connect",
    "expire_prompts",
    "has_plan",
    "insert_plan_run",
    "lease_is_held",
    "load_activities",
    "load_active_participants",
    "load_availability",
    "load_availability_state",
    "load_due_prompts",
    "load_history",
    "load_planned_dates",
    "load_prompts_on",
    "load_running_studies",
    "load_study",
    "mark_sent_if_leader",
    "release_lease",
    "renew_lease",
    "write_plan",
]
