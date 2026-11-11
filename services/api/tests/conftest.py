import os
import secrets
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

API_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE_URL = "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
# Several runs at once each set their own name, so they do not share one database.
TEST_DATABASE_NAME = os.environ.get("FIELDNOTE_TEST_DATABASE", "fieldnote_test")
TEST_PASSWORD = "correct horse battery staple"

_base_url = make_url(os.environ.get("FIELDNOTE_DATABASE_URL", DEFAULT_DATABASE_URL))
_test_url = (
    _base_url
    if _base_url.database == TEST_DATABASE_NAME
    else _base_url.set(database=TEST_DATABASE_NAME)
)
# The application engine is created on import, so point it at the test database first.
os.environ["FIELDNOTE_DATABASE_URL"] = _test_url.render_as_string(hide_password=False)

from app.config import settings  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Participant, Study, UserAccount  # noqa: E402
from app.models.enums import ParticipantStatus, ScheduleStyle, UserRole  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402
from app.security.tokens import create_access_token, hash_token  # noqa: E402

# Argon2 already slows the tests down; the progressive delay is not what is under test.
settings.login_failure_delay_seconds = 0.0

engine = create_engine(
    _test_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)


def _create_database_if_missing() -> None:
    maintenance_database = (
        _base_url.database if _base_url.database != TEST_DATABASE_NAME else "postgres"
    )
    maintenance_engine = create_engine(
        _base_url.set(database=maintenance_database),
        isolation_level="AUTOCOMMIT",
        connect_args={"connect_timeout": 5},
    )
    try:
        with maintenance_engine.connect() as connection:
            exists = connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": TEST_DATABASE_NAME},
            )
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{TEST_DATABASE_NAME}"'))
    finally:
        maintenance_engine.dispose()


def _run_migrations() -> None:
    config = Config(str(API_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(API_DIR / "migrations"))
    command.upgrade(config, "head")


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    _create_database_if_missing()
    _run_migrations()
    yield


@pytest.fixture
def session() -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    test_session = Session(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield test_session
    finally:
        test_session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    def override() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = override
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(session: Session) -> Callable[..., UserAccount]:
    def _make_user(
        email: str = "researcher@example.org",
        password: str = TEST_PASSWORD,
        role: UserRole = UserRole.RESEARCHER,
        totp_secret: str | None = None,
        totp_confirmed: bool = True,
    ) -> UserAccount:
        user = UserAccount(
            email=email,
            password_hash=hash_password(password),
            role=role,
            totp_secret=totp_secret,
            totp_confirmed_at=(
                datetime.now(UTC) if totp_secret is not None and totp_confirmed else None
            ),
        )
        session.add(user)
        session.commit()
        return user

    return _make_user


@pytest.fixture
def make_study(session: Session) -> Callable[..., Study]:
    def _make_study(title: str = "A study") -> Study:
        study = Study(
            title=title,
            timezone="Europe/Lisbon",
            max_prompts_per_day=4,
            max_prompts_per_slot=2,
            schedule_style=ScheduleStyle.BALANCED,
            device_salt=secrets.token_bytes(32),
        )
        session.add(study)
        session.commit()
        return study

    return _make_study


@pytest.fixture
def make_participant(session: Session) -> Callable[..., Participant]:
    def _make_participant(
        study: Study,
        device_token: str | None = None,
        alias: str = "P01",
    ) -> Participant:
        participant = Participant(
            study_id=study.id,
            alias=alias,
            status=ParticipantStatus.ACTIVE,
            device_token_hash=hash_token(device_token) if device_token else None,
            entered_at=datetime.now(UTC),
        )
        session.add(participant)
        session.commit()
        return participant

    return _make_participant


@pytest.fixture
def bearer_headers() -> Callable[[UserAccount], dict[str, str]]:
    def _bearer_headers(user: UserAccount) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user)}"}

    return _bearer_headers
