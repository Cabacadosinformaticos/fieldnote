"""The leader lease: acquisition, renewal, takeover and loss on a database error."""

from __future__ import annotations

import psycopg
import pytest
from psycopg import Connection

from scheduler import db
from scheduler.lease import LeaderLease


def test_only_one_replica_holds_the_lease(conn: Connection) -> None:
    first = LeaderLease("scheduler", "replica-a", 15, 5, monotonic=lambda: 0.0)
    second = LeaderLease("scheduler", "replica-b", 15, 5, monotonic=lambda: 0.0)

    assert first.refresh(conn)
    assert first.held
    assert not second.refresh(conn)
    assert not second.held


def test_renewal_keeps_the_same_holder(conn: Connection) -> None:
    clock = [0.0]
    lease = LeaderLease("scheduler", "replica-a", 15, 5, monotonic=lambda: clock[0])
    assert lease.refresh(conn)

    clock[0] = 5.0
    assert lease.refresh(conn)
    row = conn.execute(
        "SELECT holder, expires_at > now() FROM leader_lease WHERE name = 'scheduler'"
    ).fetchone()
    assert row == ("replica-a", True)


def test_expired_lease_is_taken_by_the_standby(conn: Connection) -> None:
    first = LeaderLease("scheduler", "replica-a", 15, 5, monotonic=lambda: 0.0)
    second = LeaderLease("scheduler", "replica-b", 15, 5, monotonic=lambda: 0.0)
    assert first.refresh(conn)
    assert not second.refresh(conn)

    conn.execute(
        "UPDATE leader_lease SET expires_at = now() - interval '1 second' WHERE name = 'scheduler'"
    )

    assert second.refresh(conn)
    assert second.held
    assert not first.renew_now(conn)
    assert not first.held


def test_database_error_during_renewal_stops_the_holder(
    conn: Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = [0.0]
    lease = LeaderLease("scheduler", "replica-a", 15, 5, monotonic=lambda: clock[0])
    assert lease.refresh(conn)

    def fail(*_args: object, **_kwargs: object) -> None:
        raise psycopg.OperationalError("database is gone")

    monkeypatch.setattr(db, "renew_lease", fail)
    clock[0] = 5.0
    with pytest.raises(psycopg.OperationalError):
        lease.refresh(conn)
    assert not lease.held


def test_release_makes_the_lease_available_at_once(conn: Connection) -> None:
    lease = LeaderLease("scheduler", "replica-a", 15, 5, monotonic=lambda: 0.0)
    assert lease.refresh(conn)
    lease.release(conn)
    assert not lease.held
    assert not db.lease_is_held(conn, "scheduler", "replica-a")
