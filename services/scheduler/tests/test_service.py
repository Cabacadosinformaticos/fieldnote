"""The service loop: startup planning, replanning, sending and lease safety."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import psycopg
import pytest
from psycopg import Connection

from scheduler import db
from scheduler.push import PushMessage, PushResult
from scheduler.service import SchedulerService, _cutoff_time
from scheduler.settings import Settings

TODAY = date(2026, 11, 2)
NOW = datetime(2026, 11, 2, 10, 7, 30, tzinfo=UTC)
EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]


class RecordingPush:
    def __init__(self) -> None:
        self.messages: list[PushMessage] = []

    def send(self, messages: Sequence[PushMessage]) -> list[PushResult]:
        self.messages.extend(messages)
        return [PushResult(message.prompt_id, delivered=True) for message in messages]


class FailingConnection:
    def execute(self, *_args: object, **_kwargs: object) -> None:
        raise psycopg.OperationalError("database is gone")

    def close(self) -> None:
        return None


@pytest.fixture
def push() -> RecordingPush:
    return RecordingPush()


@pytest.fixture
def service(settings: Settings, conn: Connection, push: RecordingPush) -> SchedulerService:
    return SchedulerService(
        settings,
        connection_factory=lambda: conn,
        push_client=push,  # type: ignore[arg-type]
        monotonic=lambda: 0.0,
        replica_id="replica-test",
    )


def test_run_once_plans_today_on_startup_only_once(
    service: SchedulerService,
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    make_availability: Callable[..., UUID],
) -> None:
    study_id = make_study()
    make_activity(study_id)
    participant_id = make_participant(study_id)
    make_availability(participant_id, start_time=time(8), end_time=time(12), weekdays=EVERY_DAY)

    service.run_once(NOW)
    prompts = db.load_prompts_on(conn, [participant_id], TODAY)

    assert len(prompts) == 1
    assert prompts[0].status == "planned"
    local = prompts[0].scheduled_at.astimezone(ZoneInfo("UTC"))
    assert local.date() == TODAY
    assert time(10, 15) <= local.time() < time(12)
    runs = conn.execute(
        "SELECT count(*) FROM plan_run WHERE study_id = %s AND plan_date = %s",
        (study_id, TODAY),
    ).fetchone()
    assert runs is not None and runs[0] == 1

    service.run_once(NOW + timedelta(seconds=1))

    assert len(db.load_prompts_on(conn, [participant_id], TODAY)) == 1
    runs = conn.execute(
        "SELECT count(*) FROM plan_run WHERE study_id = %s AND plan_date = %s",
        (study_id, TODAY),
    ).fetchone()
    assert runs is not None and runs[0] == 1


def test_availability_change_replans_the_remaining_prompts(
    service: SchedulerService,
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    make_availability: Callable[..., UUID],
) -> None:
    study_id = make_study()
    make_activity(
        study_id,
        prompts_per_day=2,
        window_start=time(8),
        window_end=time(20),
    )
    participant_id = make_participant(study_id)
    make_availability(participant_id, start_time=time(8), end_time=time(10), weekdays=EVERY_DAY)

    service.run_once(datetime(2026, 11, 2, 7, 0, tzinfo=UTC))
    before = db.load_prompts_on(conn, [participant_id], TODAY)
    assert len(before) == 2
    assert all(row.scheduled_at is not None and row.scheduled_at.hour < 10 for row in before)

    sent_prompt = min(before, key=lambda row: row.scheduled_at or datetime.min.replace(tzinfo=UTC))
    conn.execute(
        "UPDATE prompt SET status = 'sent', sent_at = now() WHERE id = %s",
        (sent_prompt.id,),
    )
    conn.execute("DELETE FROM availability WHERE participant_id = %s", (participant_id,))
    make_availability(participant_id, start_time=time(15), end_time=time(18), weekdays=EVERY_DAY)

    changed = service.poll_availability_changes(conn, datetime(2026, 11, 2, 12, 0, tzinfo=UTC))

    assert changed == [(study_id, participant_id)]
    after = db.load_prompts_on(conn, [participant_id], TODAY)
    assert len(after) == 2
    unchanged = next(row for row in after if row.id == sent_prompt.id)
    assert unchanged.status == "sent"
    assert unchanged.scheduled_at == sent_prompt.scheduled_at
    remaining = next(row for row in after if row.id != sent_prompt.id)
    assert remaining.status == "planned"
    assert remaining.scheduled_at is not None
    assert time(15) <= remaining.scheduled_at.time() < time(18)

    assert service.poll_availability_changes(conn, datetime(2026, 11, 2, 12, 0, tzinfo=UTC)) == []


def test_replanning_twice_keeps_one_prompt_per_occurrence(
    service: SchedulerService,
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    make_availability: Callable[..., UUID],
) -> None:
    study_id = make_study()
    make_activity(study_id, window_start=time(8), window_end=time(20))
    participant_id = make_participant(study_id)
    make_availability(participant_id, start_time=time(8), end_time=time(10), weekdays=EVERY_DAY)
    service.run_once(datetime(2026, 11, 2, 7, 0, tzinfo=UTC))
    first = db.load_prompts_on(conn, [participant_id], TODAY)
    conn.execute("DELETE FROM availability WHERE participant_id = %s", (participant_id,))
    make_availability(participant_id, start_time=time(15), end_time=time(18), weekdays=EVERY_DAY)

    service.replan_study_participant(conn, study_id, participant_id, TODAY, NOW)
    once = db.load_prompts_on(conn, [participant_id], TODAY)
    service.replan_study_participant(conn, study_id, participant_id, TODAY, NOW)
    twice = db.load_prompts_on(conn, [participant_id], TODAY)

    assert len(first) == len(once) == len(twice) == 1
    assert once[0].id == twice[0].id
    assert once[0].scheduled_at == twice[0].scheduled_at


def test_send_due_prompts_marks_sent_and_pushes(
    service: SchedulerService,
    conn: Connection,
    push: RecordingPush,
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
        plan_date=TODAY,
        scheduled_at=NOW - timedelta(minutes=1),
    )
    assert service.lease.refresh(conn)

    assert service.send_due_prompts(conn, NOW) == 1

    assert [message.prompt_id for message in push.messages] == [prompt_id]
    row = conn.execute("SELECT status, sent_at FROM prompt WHERE id = %s", (prompt_id,)).fetchone()
    assert row is not None and row[0] == "sent" and row[1] is not None
    assert service.send_due_prompts(conn, NOW) == 0


def test_send_stops_when_the_lease_is_gone(
    service: SchedulerService,
    conn: Connection,
    push: RecordingPush,
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
        plan_date=TODAY,
        scheduled_at=NOW - timedelta(minutes=1),
    )
    assert service.lease.refresh(conn)
    conn.execute(
        "UPDATE leader_lease SET expires_at = now() - interval '1 second' WHERE name = %s",
        (service.lease.name,),
    )

    assert service.send_due_prompts(conn, NOW) == 0
    assert push.messages == []
    assert not service.lease.held
    row = conn.execute("SELECT status FROM prompt WHERE id = %s", (prompt_id,)).fetchone()
    assert row is not None and row[0] == "planned"


def test_a_failed_database_call_stops_the_cycle(settings: Settings, push: RecordingPush) -> None:
    service = SchedulerService(
        settings,
        connection_factory=FailingConnection,  # type: ignore[arg-type]
        push_client=push,  # type: ignore[arg-type]
        monotonic=lambda: 0.0,
        replica_id="replica-test",
    )

    service.run_once(NOW)

    assert not service.lease.held
    assert push.messages == []


def test_the_planning_hour_plans_the_next_day(
    service: SchedulerService,
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    make_availability: Callable[..., UUID],
) -> None:
    study_id = make_study()
    make_activity(study_id)
    participant_id = make_participant(study_id)
    make_availability(participant_id, start_time=time(8), end_time=time(12), weekdays=EVERY_DAY)

    service.run_once(datetime(2026, 11, 2, 22, 5, tzinfo=UTC))

    runs = conn.execute(
        "SELECT plan_date FROM plan_run WHERE study_id = %s ORDER BY plan_date", (study_id,)
    ).fetchall()
    assert [row[0] for row in runs] == [TODAY, TODAY + timedelta(days=1)]
    tomorrow = db.load_prompts_on(conn, [participant_id], TODAY + timedelta(days=1))
    assert len(tomorrow) == 1 and tomorrow[0].status == "planned"
    assert tomorrow[0].scheduled_at is not None
    assert time(8) <= tomorrow[0].scheduled_at.time() < time(12)


def test_the_study_time_zone_decides_which_day_is_today(
    service: SchedulerService,
    conn: Connection,
    make_study: Callable[..., UUID],
    make_activity: Callable[..., UUID],
    make_participant: Callable[..., UUID],
    make_availability: Callable[..., UUID],
) -> None:
    study_id = make_study(timezone="Pacific/Auckland")
    make_activity(study_id, window_start=time(14), window_end=time(16))
    participant_id = make_participant(study_id)
    make_availability(participant_id, start_time=time(14), end_time=time(16), weekdays=EVERY_DAY)

    # 23:30 UTC on 1 November is 12:30 on 2 November in Auckland (UTC+13, daylight saving).
    service.run_once(datetime(2026, 11, 1, 23, 30, tzinfo=UTC))

    prompts = db.load_prompts_on(conn, [participant_id], date(2026, 11, 2))
    assert len(prompts) == 1
    assert prompts[0].scheduled_at is not None
    local = prompts[0].scheduled_at.astimezone(ZoneInfo("Pacific/Auckland"))
    assert local.date() == date(2026, 11, 2)
    assert time(14) <= local.time() < time(16)


def test_cutoff_is_the_next_quarter_hour() -> None:
    assert _cutoff_time(datetime(2026, 11, 2, 10, 7, 30)) == time(10, 15)
    assert _cutoff_time(datetime(2026, 11, 2, 10, 15, 0)) == time(10, 15)
    assert _cutoff_time(datetime(2026, 11, 2, 10, 15, 1)) == time(10, 30)
    assert _cutoff_time(datetime(2026, 11, 2, 23, 59, 0)) == time(23, 59, 59)


def test_unknown_participant_is_not_replanned(service: SchedulerService, conn: Connection) -> None:
    assert service.replan_study_participant(conn, uuid4(), uuid4(), TODAY, NOW) is None
