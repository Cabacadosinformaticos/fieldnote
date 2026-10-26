"""Fixtures for the scheduler service tests, backed by the dev PostgreSQL.

The tests use the `fieldnote_test` database that the API test suite creates. If the schema is
missing, the API migrations are applied from `../api`; every test then runs in a transaction that
is rolled back, so the database is left as it was found.
"""

from __future__ import annotations

import os
import subprocess
from collections.abc import Callable, Iterator
from datetime import date, datetime, time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg import Connection

from scheduler.settings import Settings

SERVICES_DIR = Path(__file__).resolve().parents[2]
API_DIR = SERVICES_DIR / "api"
TEST_DATABASE_URL = os.environ.get(
    "FIELDNOTE_TEST_DATABASE_URL",
    "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote_test",
)


def libpq_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )


def with_database(url: str, database: str) -> str:
    parts = urlsplit(libpq_url(url))
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def _create_database_if_missing() -> None:
    maintenance = with_database(TEST_DATABASE_URL, "postgres")
    with psycopg.connect(maintenance, autocommit=True, connect_timeout=5) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", ("fieldnote_test",)
        ).fetchone()
        if not exists:
            connection.execute('CREATE DATABASE "fieldnote_test"')


def _upgrade_schema() -> None:
    environment = os.environ.copy()
    environment["FIELDNOTE_DATABASE_URL"] = TEST_DATABASE_URL
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        pytest.fail(
            "alembic upgrade head failed in ../api\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    _create_database_if_missing()
    with psycopg.connect(
        libpq_url(TEST_DATABASE_URL), autocommit=True, connect_timeout=5
    ) as connection:
        row = connection.execute("SELECT to_regclass('public.study') IS NOT NULL").fetchone()
    if not row or not row[0]:
        _upgrade_schema()
    yield


@pytest.fixture
def conn() -> Iterator[Connection]:
    connection = psycopg.connect(libpq_url(TEST_DATABASE_URL), autocommit=True, connect_timeout=5)
    try:
        with connection.transaction(force_rollback=True):
            yield connection
    finally:
        connection.close()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url=TEST_DATABASE_URL,
        expo_access_token="test-expo-token",
        lease_ttl_seconds=15,
        lease_renew_seconds=5,
        tick_seconds=5,
        replan_poll_seconds=10,
    )


@pytest.fixture
def make_study(conn: Connection) -> Callable[..., UUID]:
    def _make_study(
        *,
        timezone: str = "UTC",
        max_prompts_per_day: int = 10,
        max_prompts_per_slot: int = 10,
        schedule_style: str = "varied",
        status: str = "running",
        starts_on: date | None = None,
        ends_on: date | None = None,
    ) -> UUID:
        study_id = uuid4()
        conn.execute(
            """
            INSERT INTO study
                (id, title, status, timezone, max_prompts_per_day, max_prompts_per_slot,
                 schedule_style, device_salt, starts_on, ends_on)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                study_id,
                "Test study",
                status,
                timezone,
                max_prompts_per_day,
                max_prompts_per_slot,
                schedule_style,
                b"\x00" * 32,
                starts_on,
                ends_on,
            ),
        )
        return study_id

    return _make_study


@pytest.fixture
def make_activity(conn: Connection) -> Callable[..., UUID]:
    def _make_activity(
        study_id: UUID,
        *,
        prompts_per_day: int = 1,
        min_gap_minutes: int = 0,
        window_start: time = time(8),
        window_end: time = time(12),
    ) -> UUID:
        activity_id = uuid4()
        conn.execute(
            """
            INSERT INTO activity
                (id, study_id, title, entry_types, prompts_per_day, window_start, window_end,
                 min_gap_minutes, expected_minutes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                activity_id,
                study_id,
                "Test activity",
                ["text"],
                prompts_per_day,
                window_start,
                window_end,
                min_gap_minutes,
                5,
            ),
        )
        return activity_id

    return _make_activity


@pytest.fixture
def make_participant(conn: Connection) -> Callable[..., UUID]:
    def _make_participant(
        study_id: UUID,
        *,
        status: str = "active",
        availability_any_time: bool = False,
        push_token: str | None = "ExponentPushToken[test]",
        locale: str | None = "pt",
    ) -> UUID:
        participant_id = uuid4()
        conn.execute(
            """
            INSERT INTO participant
                (id, study_id, alias, status, availability_any_time, push_token, locale)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                participant_id,
                study_id,
                "alias",
                status,
                availability_any_time,
                push_token,
                locale,
            ),
        )
        return participant_id

    return _make_participant


@pytest.fixture
def make_availability(conn: Connection) -> Callable[..., UUID]:
    def _make_availability(
        participant_id: UUID,
        *,
        start_time: time = time(8),
        end_time: time = time(12),
        weekdays: list[int] | None = None,
    ) -> UUID:
        availability_id = uuid4()
        conn.execute(
            """
            INSERT INTO availability (id, participant_id, start_time, end_time, weekdays)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                availability_id,
                participant_id,
                start_time,
                end_time,
                weekdays or [1, 2, 3, 4, 5, 6, 7],
            ),
        )
        return availability_id

    return _make_availability


@pytest.fixture
def insert_prompt(conn: Connection) -> Callable[..., UUID]:
    def _insert_prompt(
        participant_id: UUID,
        activity_id: UUID,
        *,
        plan_date: date,
        occurrence: int = 0,
        scheduled_at: datetime | None = None,
        status: str = "planned",
        unplanned_reason: str | None = None,
    ) -> UUID:
        prompt_id = uuid4()
        conn.execute(
            """
            INSERT INTO prompt
                (id, activity_id, participant_id, plan_date, occurrence, scheduled_at,
                 status, unplanned_reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                prompt_id,
                activity_id,
                participant_id,
                plan_date,
                occurrence,
                scheduled_at,
                status,
                unplanned_reason,
            ),
        )
        return prompt_id

    return _insert_prompt
