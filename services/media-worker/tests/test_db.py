"""The audit row the worker writes when a media job fails (FR-68)."""

from __future__ import annotations

import json
from uuid import UUID

from media_worker import db

MEDIA_OBJECT_ID = UUID("2f1c4a3e-7b1e-4b8f-9d2a-6c5e8f0a1b3c")
ENTRY_ID = UUID("8a5b6c7d-1e2f-4a3b-9c4d-5e6f7a8b9c0d")


class FakeCursor:
    def __init__(self, row=None, rowcount: int = 1) -> None:
        self._row = row
        self.rowcount = rowcount

    def fetchone(self):
        return self._row


class FakeConnection:
    def __init__(self, media_row, *, rowcount: int = 1) -> None:
        self.media_row = media_row
        self.rowcount = rowcount
        self.calls: list[tuple[str, tuple]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, sql: str, parameters: tuple = ()):
        self.calls.append((sql, parameters))
        if "SELECT" in sql:
            return FakeCursor(self.media_row)
        return FakeCursor(rowcount=self.rowcount)


def _repository(monkeypatch, connection: FakeConnection) -> db.MediaObjectRepository:
    monkeypatch.setattr(db.psycopg, "connect", lambda *args, **kwargs: connection)
    return db.MediaObjectRepository(
        "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    )


def _audit_call(connection: FakeConnection) -> tuple[str, tuple]:
    inserts = [call for call in connection.calls if "INSERT INTO audit_log" in call[0]]
    assert len(inserts) == 1
    return inserts[0]


def test_mark_failed_targets_the_participant_alias_and_keeps_the_reason(monkeypatch) -> None:
    connection = FakeConnection((ENTRY_ID, "P-09"))

    _repository(monkeypatch, connection).mark_failed(MEDIA_OBJECT_ID, reason="unsupported codec")

    sql, parameters = _audit_call(connection)
    assert "'system'::audit_actor_type" in sql
    assert "'media_failed'" in sql
    assert "'automatic_task'" in sql
    assert parameters[0] == "P-09"
    assert json.loads(parameters[1]) == {"reason": "unsupported codec"}
    updates = [call for call in connection.calls if "UPDATE media_object" in call[0]]
    assert updates and updates[0][1] == (MEDIA_OBJECT_ID,)


def test_mark_failed_falls_back_to_the_entry_id(monkeypatch) -> None:
    connection = FakeConnection((ENTRY_ID, None))

    _repository(monkeypatch, connection).mark_failed(MEDIA_OBJECT_ID, reason="missing")

    _sql, parameters = _audit_call(connection)
    assert parameters[0] == str(ENTRY_ID)


def test_mark_failed_without_a_media_row_writes_no_audit_row(monkeypatch) -> None:
    connection = FakeConnection(None, rowcount=0)

    _repository(monkeypatch, connection).mark_failed(MEDIA_OBJECT_ID, reason="missing")

    assert not any("INSERT INTO audit_log" in call[0] for call in connection.calls)
