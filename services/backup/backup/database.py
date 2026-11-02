"""PostgreSQL dump, filtered copy and restore helpers."""

from __future__ import annotations

import os
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from backup.config import Settings
from backup.errors import BackupError

PARTICIPANT_OBJECT_PREFIX = "entries"
PENDING_STATUS = "erasure_scheduled"


@dataclass(frozen=True)
class SourceCounts:
    pending_participants: tuple[uuid.UUID, ...]
    entries: int
    media_objects: int

    def skipped_object_prefixes(self) -> tuple[str, ...]:
        return tuple(
            f"{PARTICIPANT_OBJECT_PREFIX}/{participant_id}/"
            for participant_id in self.pending_participants
        )


def libpq_url(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def _command_env(conninfo: str) -> tuple[list[str], dict[str, str]]:
    params = conninfo_to_dict(conninfo)
    password = params.pop("password", None)
    dbname = params.pop("dbname", None)
    if dbname is not None:
        params["dbname"] = dbname
    env = dict(os.environ)
    if password:
        env["PGPASSWORD"] = password
    return ["--dbname", make_conninfo(**params)], env


def _run(command: list[str], env: dict[str, str], description: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise BackupError(f"{description} failed: {detail}")


def _pg_dump(settings: Settings, conninfo: str, destination: Path) -> None:
    connection_args, env = _command_env(conninfo)
    _run(
        [
            settings.pg_dump,
            "--format=custom",
            "--no-password",
            f"--file={destination}",
            *connection_args,
        ],
        env,
        "pg_dump",
    )


def _pg_restore(settings: Settings, conninfo: str, dump_path: Path) -> None:
    connection_args, env = _command_env(conninfo)
    _run(
        [
            settings.pg_restore,
            "--no-owner",
            "--no-acl",
            "--exit-on-error",
            *connection_args,
            str(dump_path),
        ],
        env,
        "pg_restore",
    )


def pending_participants(settings: Settings) -> tuple[uuid.UUID, ...]:
    with psycopg.connect(libpq_url(settings.database_url)) as connection:
        rows = connection.execute(
            "SELECT id FROM participant WHERE status::text = %s ORDER BY id",
            (PENDING_STATUS,),
        ).fetchall()
    return tuple(row[0] for row in rows)


def source_counts(
    settings: Settings, pending: tuple[uuid.UUID, ...] | None = None
) -> SourceCounts:
    pending = pending_participants(settings) if pending is None else pending
    with psycopg.connect(libpq_url(settings.database_url)) as connection:
        if pending:
            entries = connection.execute(
                "SELECT count(*) FROM entry WHERE participant_id <> ALL(%s::uuid[])",
                (list(pending),),
            ).fetchone()[0]
            media_objects = connection.execute(
                "SELECT count(*) FROM media_object AS media "
                "LEFT JOIN entry ON entry.id = media.entry_id "
                "WHERE entry.participant_id IS NULL "
                "OR entry.participant_id <> ALL(%s::uuid[])",
                (list(pending),),
            ).fetchone()[0]
        else:
            entries = connection.execute("SELECT count(*) FROM entry").fetchone()[0]
            media_objects = connection.execute("SELECT count(*) FROM media_object").fetchone()[0]
    return SourceCounts(
        pending_participants=pending,
        entries=int(entries),
        media_objects=int(media_objects),
    )


def _maintenance_conninfo(settings: Settings) -> str:
    params = conninfo_to_dict(libpq_url(settings.database_url))
    params["dbname"] = "postgres"
    return make_conninfo(**params)


def _create_temporary_database(settings: Settings) -> tuple[str, str]:
    name = f"fieldnote_backup_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(_maintenance_conninfo(settings), autocommit=True) as connection:
        connection.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)),
        )
    params = conninfo_to_dict(libpq_url(settings.database_url))
    params["dbname"] = name
    return name, make_conninfo(**params)


def _drop_temporary_database(settings: Settings, name: str) -> None:
    with psycopg.connect(_maintenance_conninfo(settings), autocommit=True) as connection:
        connection.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)),
        )


def _delete_pending_participants(conninfo: str, pending: tuple[uuid.UUID, ...]) -> None:
    with psycopg.connect(conninfo) as connection:
        connection.execute(
            "DELETE FROM participant WHERE id = ANY(%s::uuid[])",
            (list(pending),),
        )
        connection.commit()


def dump_database(settings: Settings, destination: Path, pending: tuple[uuid.UUID, ...]) -> None:
    """Write a custom-format dump that leaves out participants whose erasure is pending.

    PostgreSQL refuses ``CREATE DATABASE ... TEMPLATE`` while the source has sessions, so a
    pending erasure is handled by restoring the dump into a temporary database, deleting the
    participant rows (the foreign keys cascade) and dumping that database again.
    """
    destination = Path(destination)
    source_conninfo = libpq_url(settings.database_url)
    if not pending:
        _pg_dump(settings, source_conninfo, destination)
        return

    with tempfile.TemporaryDirectory(prefix="fieldnote-backup-") as temporary:
        full_dump = Path(temporary) / "full.dump"
        _pg_dump(settings, source_conninfo, full_dump)

        name, temporary_conninfo = _create_temporary_database(settings)
        try:
            _pg_restore(settings, temporary_conninfo, full_dump)
            _delete_pending_participants(temporary_conninfo, pending)
            _pg_dump(settings, temporary_conninfo, destination)
        finally:
            _drop_temporary_database(settings, name)


def restore_database(settings: Settings, dump_path: Path) -> None:
    _pg_restore(settings, libpq_url(settings.database_url), Path(dump_path))


def restore_counts(settings: Settings) -> tuple[int, int]:
    with psycopg.connect(libpq_url(settings.database_url)) as connection:
        entries = connection.execute("SELECT count(*) FROM entry").fetchone()[0]
        media_objects = connection.execute("SELECT count(*) FROM media_object").fetchone()[0]
    return int(entries), int(media_objects)
