"""Database writes, idempotency, sending and expiry against the dev PostgreSQL."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from psycopg import Connection

from scheduler import db
from scheduler.model import (
    Activity,
    AvailabilityInterval,
    Participant,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    TimeWindow,
)
from scheduler.plan import plan_day

PLAN_DATE = date(2026, 11, 2)
NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)
EVERY_DAY = frozenset(range(1, 8))


def _study_day(
    study_id: UUID,
    activity_id: UUID,
    participant_id: UUID,
    *,
    availability: tuple[AvailabilityInterval, ...] = (),
    any_time: bool = False,
) -> StudyDay:
    return StudyDay(
        study=StudyConfig(
            id=str(study_id),
            schedule_style=ScheduleStyle.VARIED,
            max_prompts_per_day=10,
            max_prompts_per_slot=10,
        ),
        plan_date=PLAN_DATE,
        activities=(
            Activity(
                id=str(activity_id),
                prompts_per_day=1,
                min_gap_minutes=0,
                window=TimeWindow(start=time(8), end=time(12)),
            ),
        ),
        participants=(
            Participant(
                id=str(participant_id),
                availability=availability
                if availability
                else (AvailabilityInterval(start=time(8), end=time(12), weekdays=EVERY_DAY),),
                any_time=any_time,
            ),
        ),
    )


def test_write_plan_is_idempotent(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id)
    participant_id = make_participant(study_id)
    plan = plan_day(_study_day(study_id, activity_id, participant_id))

    db.write_plan(conn, study_id, plan)
    first = db.load_prompts_on(conn, [participant_id], PLAN_DATE)
    db.write_plan(conn, study_id, plan)
    second = db.load_prompts_on(conn, [participant_id], PLAN_DATE)

    assert len(first) == 1
    assert [(row.id, row.status, row.scheduled_at) for row in first] == [
        (row.id, row.status, row.scheduled_at) for row in second
    ]
    runs = conn.execute("SELECT count(*) FROM plan_run WHERE study_id = %s", (study_id,)).fetchone()
    assert runs is not None and runs[0] == 2


def test_write_plan_audits_each_finished_run(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id)
    participant_id = make_participant(study_id)
    plan = plan_day(_study_day(study_id, activity_id, participant_id))

    db.write_plan(conn, study_id, plan)

    rows = conn.execute(
        """
        SELECT actor_type, actor_id, action, target, details, origin_client
        FROM audit_log
        WHERE action = 'plan_completed' AND target = %s
        """,
        (str(study_id),),
    ).fetchall()
    assert len(rows) == 1
    actor_type, actor_id, action, target, details, origin_client = rows[0]
    assert actor_type == "system"
    assert actor_id is None
    assert action == "plan_completed"
    assert target == str(study_id)
    assert origin_client == "scheduled_task"
    assert details["planned"] == 1
    assert details["unplanned"] == 0
    assert details["search"] == "complete"
    assert details["seconds"] >= 0


def test_write_plan_never_overwrites_a_sent_prompt(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id)
    participant_id = make_participant(study_id)
    first_plan = plan_day(_study_day(study_id, activity_id, participant_id))
    db.write_plan(conn, study_id, first_plan)
    before = db.load_prompts_on(conn, [participant_id], PLAN_DATE)[0]
    conn.execute("UPDATE prompt SET status = 'sent' WHERE id = %s", (before.id,))

    later = _study_day(
        study_id,
        activity_id,
        participant_id,
        availability=(AvailabilityInterval(start=time(10), end=time(12), weekdays=EVERY_DAY),),
    )
    db.write_plan(conn, study_id, plan_day(later))

    after = db.load_prompts_on(conn, [participant_id], PLAN_DATE)[0]
    assert after.status == "sent"
    assert after.scheduled_at == before.scheduled_at


def test_due_prompts_are_sent_only_while_holding_the_lease(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    insert_prompt: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id)
    participant_id = make_participant(study_id)
    prompt_id = insert_prompt(
        participant_id,
        activity_id,
        plan_date=PLAN_DATE,
        scheduled_at=NOW - timedelta(minutes=1),
    )

    assert db.acquire_lease(conn, "scheduler", "replica-a", 60) is not None
    assert [row.id for row in db.load_due_prompts(conn, NOW, 100)] == [prompt_id]
    assert not db.mark_sent_if_leader(conn, prompt_id, "scheduler", "replica-b")
    assert db.mark_sent_if_leader(conn, prompt_id, "scheduler", "replica-a")
    assert db.load_due_prompts(conn, NOW, 100) == []

    row = conn.execute("SELECT status, sent_at FROM prompt WHERE id = %s", (prompt_id,)).fetchone()
    assert row is not None and row[0] == "sent" and row[1] is not None
    assert not db.mark_sent_if_leader(conn, prompt_id, "scheduler", "replica-a")


def test_expire_prompts_uses_the_activity_window(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    insert_prompt: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id, window_start=time(8), window_end=time(12))
    participant_id = make_participant(study_id)
    yesterday = insert_prompt(
        participant_id,
        activity_id,
        plan_date=PLAN_DATE - timedelta(days=1),
        occurrence=0,
        scheduled_at=datetime(2026, 11, 1, 9, 0, tzinfo=UTC),
    )
    sent = insert_prompt(
        participant_id,
        activity_id,
        plan_date=PLAN_DATE,
        occurrence=1,
        scheduled_at=datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        status="sent",
    )
    later_today = insert_prompt(
        participant_id,
        activity_id,
        plan_date=PLAN_DATE,
        occurrence=2,
        scheduled_at=datetime(2026, 11, 2, 11, 0, tzinfo=UTC),
    )
    answered = insert_prompt(
        participant_id,
        activity_id,
        plan_date=PLAN_DATE,
        occurrence=3,
        scheduled_at=datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        status="answered",
    )

    assert db.expire_prompts(conn, datetime(2026, 11, 2, 10, 30, tzinfo=UTC)) == 1
    statuses = _statuses(conn, [yesterday, sent, later_today, answered])
    assert statuses == {
        yesterday: "expired",
        sent: "sent",
        later_today: "planned",
        answered: "answered",
    }

    assert db.expire_prompts(conn, datetime(2026, 11, 2, 13, 0, tzinfo=UTC)) == 2
    statuses = _statuses(conn, [yesterday, sent, later_today, answered])
    assert statuses == {
        yesterday: "expired",
        sent: "expired",
        later_today: "expired",
        answered: "answered",
    }


def test_lease_takeover_and_expiry(conn: Connection) -> None:
    assert db.acquire_lease(conn, "scheduler", "replica-a", 60) is not None
    assert db.acquire_lease(conn, "scheduler", "replica-b", 60) is None
    assert db.renew_lease(conn, "scheduler", "replica-a", 60) is not None

    conn.execute(
        "UPDATE leader_lease SET expires_at = now() - interval '1 second' "
        "WHERE name = %s AND holder = %s",
        ("scheduler", "replica-a"),
    )

    row = db.acquire_lease(conn, "scheduler", "replica-b", 60)
    assert row is not None and row.holder == "replica-b"
    assert db.renew_lease(conn, "scheduler", "replica-a", 60) is None
    assert not db.lease_is_held(conn, "scheduler", "replica-a")
    assert db.lease_is_held(conn, "scheduler", "replica-b")

    db.release_lease(conn, "scheduler", "replica-b")
    assert not db.lease_is_held(conn, "scheduler", "replica-b")
    assert db.acquire_lease(conn, "scheduler", "replica-a", 60) is not None


def test_load_activities_carries_the_entry_types(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
) -> None:
    study_id = make_study()
    activity_id = make_activity(study_id, entry_types=["photo", "video"])

    rows = db.load_activities(conn, study_id)

    assert [row.id for row in rows] == [activity_id]
    assert rows[0].entry_types == ("photo", "video")


def test_load_other_study_prompts_keeps_only_planned_and_sent_of_running_studies(
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    insert_prompt: Callable[..., UUID],
) -> None:
    load_study = make_study()
    load_activity = make_activity(load_study, entry_types=["photo", "video"])
    load_participant = make_participant(load_study)
    own_study = make_study()
    own_activity = make_activity(own_study)
    own_participant = make_participant(own_study)
    closed_study = make_study(status="closed")
    closed_activity = make_activity(closed_study)
    closed_participant = make_participant(closed_study)

    start = datetime(2026, 11, 2, 0, 0, tzinfo=UTC)
    end = datetime(2026, 11, 3, 0, 0, tzinfo=UTC)
    insert_prompt(
        load_participant,
        load_activity,
        plan_date=PLAN_DATE,
        scheduled_at=datetime(2026, 11, 2, 8, 0, tzinfo=UTC),
    )
    insert_prompt(
        load_participant,
        load_activity,
        plan_date=PLAN_DATE,
        occurrence=1,
        scheduled_at=datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        status="sent",
    )
    insert_prompt(
        load_participant,
        load_activity,
        plan_date=PLAN_DATE,
        occurrence=2,
        status="unplanned",
    )
    insert_prompt(
        load_participant,
        load_activity,
        plan_date=PLAN_DATE,
        occurrence=3,
        scheduled_at=datetime(2026, 11, 3, 0, 30, tzinfo=UTC),
    )
    insert_prompt(
        own_participant,
        own_activity,
        plan_date=PLAN_DATE,
        scheduled_at=datetime(2026, 11, 2, 8, 0, tzinfo=UTC),
    )
    insert_prompt(
        closed_participant,
        closed_activity,
        plan_date=PLAN_DATE,
        scheduled_at=datetime(2026, 11, 2, 8, 0, tzinfo=UTC),
    )

    rows = db.load_other_study_prompts(conn, own_study, start, end)

    assert [row.activity_id for row in rows] == [load_activity, load_activity]
    assert {row.study_id for row in rows} == {load_study}
    assert all(row.entry_types == ("photo", "video") for row in rows)
    assert [row.scheduled_at for row in rows] == [
        datetime(2026, 11, 2, 8, 0, tzinfo=UTC),
        datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
    ]


def _statuses(conn: Connection, prompt_ids: list[UUID]) -> dict[UUID, str]:
    rows = conn.execute(
        "SELECT id, status FROM prompt WHERE id = ANY(%s)", (prompt_ids,)
    ).fetchall()
    return {row[0]: row[1] for row in rows}
