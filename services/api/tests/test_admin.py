import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Entry, RefreshToken, StudyMember, UserAccount
from app.models.enums import AuditActorType, EntryType, StudyRole, UserRole
from app.security import tokens
from app.security.passwords import verify_password

API = "/api/v1"
ADMIN = f"{API}/admin"
LOGIN = f"{API}/auth/login"
PASSWORD = "correct horse battery staple"


@pytest.fixture
def admin(make_user) -> UserAccount:
    return make_user(email="admin@example.org", role=UserRole.ADMIN)


@pytest.fixture
def researcher(make_user) -> UserAccount:
    return make_user(email="researcher@example.org")


def _add_event(
    session: Session,
    action: str,
    *,
    at: datetime,
    actor_type: AuditActorType = AuditActorType.USER,
    actor_id: uuid.UUID | None = None,
    target: str | None = None,
    details: dict[str, object] | None = None,
) -> AuditLog:
    event = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        target=target,
        details=details,
        at=at,
    )
    session.add(event)
    session.commit()
    return event


def test_accounts_are_admin_only(
    client: TestClient, admin: UserAccount, researcher: UserAccount, bearer_headers
) -> None:
    assert client.get(f"{ADMIN}/accounts").status_code == 401
    assert client.get(f"{ADMIN}/accounts", headers=bearer_headers(researcher)).status_code == 403
    assert (
        client.post(
            f"{ADMIN}/accounts",
            headers=bearer_headers(researcher),
            json={"email": "new@example.org"},
        ).status_code
        == 403
    )


def test_create_account_returns_the_temporary_password_once_and_stores_only_its_hash(
    client: TestClient, session: Session, admin: UserAccount, bearer_headers
) -> None:
    response = client.post(
        f"{ADMIN}/accounts",
        headers=bearer_headers(admin),
        json={"email": "  New.Researcher@Example.ORG ", "role": "researcher"},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.researcher@example.org"
    assert body["role"] == "researcher"
    assert body["locked"] is False
    assert body["totp_enrolled"] is False
    password = body["temporary_password"]
    assert len(password) >= 16

    stored = session.scalar(
        select(UserAccount).where(UserAccount.email == "new.researcher@example.org")
    )
    assert stored is not None
    assert stored.password_hash != password
    assert verify_password(stored.password_hash, password)
    assert str(stored.id) == body["id"]

    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "account_created", AuditLog.target == str(stored.id)
        )
    )
    assert audit is not None
    assert audit.actor_id == admin.id
    assert audit.actor_type == AuditActorType.USER

    login = client.post(LOGIN, json={"email": "new.researcher@example.org", "password": password})
    assert login.status_code == 200


def test_create_account_refuses_a_duplicate_email_ignoring_case(
    client: TestClient, admin: UserAccount, bearer_headers
) -> None:
    headers = bearer_headers(admin)
    first = client.post(f"{ADMIN}/accounts", headers=headers, json={"email": "ana@example.org"})
    second = client.post(f"{ADMIN}/accounts", headers=headers, json={"email": "ANA@example.org"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "email_in_use"


def test_list_accounts_shows_role_and_lock_state(
    client: TestClient, admin: UserAccount, researcher: UserAccount, bearer_headers
) -> None:
    response = client.get(f"{ADMIN}/accounts", headers=bearer_headers(admin))

    assert response.status_code == 200
    rows = {row["email"]: row for row in response.json()}
    assert rows["admin@example.org"]["role"] == "admin"
    assert rows["researcher@example.org"]["role"] == "researcher"
    assert rows["researcher@example.org"]["locked"] is False


def test_change_role_is_audited_and_a_user_cannot_change_their_own_role(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
) -> None:
    headers = bearer_headers(admin)
    response = client.patch(
        f"{ADMIN}/accounts/{researcher.id}", headers=headers, json={"role": "admin"}
    )

    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    session.expire_all()
    assert session.get(UserAccount, researcher.id).role == UserRole.ADMIN
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "account_role_changed", AuditLog.target == str(researcher.id)
        )
    )
    assert audit is not None
    assert audit.details == {"email": "researcher@example.org", "role": "admin"}

    own = client.patch(f"{ADMIN}/accounts/{admin.id}", headers=headers, json={"role": "researcher"})
    assert own.status_code == 409
    assert own.json()["error"]["code"] == "cannot_change_own_role"


def test_lock_revokes_refresh_tokens_and_blocks_sign_in_until_unlocked(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
) -> None:
    _, refresh = tokens.create_refresh_token(session, researcher.id)
    session.commit()
    headers = bearer_headers(admin)

    locked = client.post(f"{ADMIN}/accounts/{researcher.id}/lock", headers=headers)

    assert locked.status_code == 200
    assert locked.json()["locked"] is True
    session.expire_all()
    assert session.get(RefreshToken, refresh.id).revoked_at is not None
    blocked = client.post(LOGIN, json={"email": researcher.email, "password": PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "account_locked"
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "account_locked", AuditLog.target == str(researcher.id)
            )
        )
        is not None
    )

    unlocked = client.post(f"{ADMIN}/accounts/{researcher.id}/unlock", headers=headers)

    assert unlocked.status_code == 200
    assert unlocked.json()["locked"] is False
    session.expire_all()
    assert session.get(UserAccount, researcher.id).locked_until is None
    login = client.post(LOGIN, json={"email": researcher.email, "password": PASSWORD})
    assert login.status_code == 200
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "account_unlocked", AuditLog.target == str(researcher.id)
            )
        )
        is not None
    )


def test_an_administrator_cannot_lock_or_delete_their_own_account(
    client: TestClient, admin: UserAccount, bearer_headers
) -> None:
    headers = bearer_headers(admin)

    assert client.post(f"{ADMIN}/accounts/{admin.id}/lock", headers=headers).status_code == 409
    assert client.delete(f"{ADMIN}/accounts/{admin.id}", headers=headers).status_code == 409


def test_delete_removes_the_account_and_is_audited(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
) -> None:
    response = client.delete(f"{ADMIN}/accounts/{researcher.id}", headers=bearer_headers(admin))

    assert response.status_code == 204
    session.expire_all()
    assert session.get(UserAccount, researcher.id) is None
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "account_deleted", AuditLog.target == str(researcher.id)
        )
    )
    assert audit is not None
    assert audit.details == {"email": "researcher@example.org"}


def test_delete_unknown_account_returns_not_found(
    client: TestClient, admin: UserAccount, bearer_headers
) -> None:
    response = client.delete(f"{ADMIN}/accounts/{uuid.uuid4()}", headers=bearer_headers(admin))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "account_not_found"


def test_study_overview_lists_every_study_with_team_owner_and_counts(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study(title="Alpha")
    other = make_study(title="Beta")
    owner = make_user(email="owner@example.org")
    member = make_user(email="member@example.org")
    session.add_all(
        [
            StudyMember(study_id=study.id, user_id=owner.id, role=StudyRole.PRINCIPAL_INVESTIGATOR),
            StudyMember(study_id=study.id, user_id=member.id, role=StudyRole.MEMBER),
        ]
    )
    session.commit()
    participant = make_participant(study, alias="P-01")
    make_participant(other, alias="P-02")
    session.add(
        Entry(
            participant_id=participant.id,
            entry_type=EntryType.TEXT,
            content_sha256="a" * 64,
            recorded_at=datetime.now(UTC),
            body="one",
        )
    )
    session.commit()

    response = client.get(f"{ADMIN}/studies", headers=bearer_headers(admin))

    assert response.status_code == 200
    rows = {row["title"]: row for row in response.json()}
    alpha = rows["Alpha"]
    assert alpha["status"] == "draft"
    assert alpha["owner_email"] == "owner@example.org"
    assert {row["email"] for row in alpha["team"]} == {
        "owner@example.org",
        "member@example.org",
    }
    assert alpha["participants"] == 1
    assert alpha["entries"] == 1
    assert rows["Beta"]["participants"] == 1
    assert rows["Beta"]["entries"] == 0
    assert rows["Beta"]["owner_email"] is None


def test_study_overview_is_admin_only(
    client: TestClient, researcher: UserAccount, bearer_headers
) -> None:
    assert client.get(f"{ADMIN}/studies", headers=bearer_headers(researcher)).status_code == 403


def test_audit_log_filters_by_actor_action_study_and_date(
    client: TestClient, session: Session, admin: UserAccount, make_study, bearer_headers
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    base = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    _add_event(
        session,
        "participant_added",
        at=base,
        target=str(study.id),
        details={"study_id": str(study.id)},
    )
    _add_event(
        session,
        "study_updated",
        at=base + timedelta(hours=1),
        target=str(other_study.id),
        details={"study_id": str(other_study.id)},
    )
    _add_event(
        session,
        "participant_erased",
        at=base + timedelta(hours=2),
        actor_type=AuditActorType.SYSTEM,
        details={"study_id": str(study.id)},
    )
    headers = bearer_headers(admin)

    by_actor = client.get(f"{ADMIN}/audit-log?actor_type=system", headers=headers)
    by_action = client.get(f"{ADMIN}/audit-log?action=participant_added", headers=headers)
    by_study = client.get(f"{ADMIN}/audit-log?study_id={study.id}", headers=headers)
    by_date = client.get(
        f"{ADMIN}/audit-log?since=2026-10-01T09:30:00Z&until=2026-10-01T10:30:00Z",
        headers=headers,
    )

    assert by_actor.status_code == 200
    assert [row["action"] for row in by_actor.json()["items"]] == ["participant_erased"]
    assert [row["action"] for row in by_action.json()["items"]] == ["participant_added"]
    assert {row["action"] for row in by_study.json()["items"]} == {
        "participant_added",
        "participant_erased",
    }
    assert [row["action"] for row in by_date.json()["items"]] == ["study_updated"]


def test_audit_log_paginates_with_a_cursor(
    client: TestClient, session: Session, admin: UserAccount, bearer_headers
) -> None:
    base = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    events = [
        _add_event(session, "login", at=base + timedelta(minutes=index)) for index in range(5)
    ]
    headers = bearer_headers(admin)

    first = client.get(f"{ADMIN}/audit-log?limit=2", headers=headers).json()
    assert [row["id"] for row in first["items"]] == [events[4].id, events[3].id]
    assert first["next_cursor"] == events[3].id

    second = client.get(
        f"{ADMIN}/audit-log?limit=2&cursor={first['next_cursor']}", headers=headers
    ).json()
    assert [row["id"] for row in second["items"]] == [events[2].id, events[1].id]
    assert second["next_cursor"] == events[1].id

    last = client.get(
        f"{ADMIN}/audit-log?limit=2&cursor={second['next_cursor']}", headers=headers
    ).json()
    assert [row["id"] for row in last["items"]] == [events[0].id]
    assert last["next_cursor"] is None


def test_audit_log_is_admin_only_and_read_only(
    client: TestClient, researcher: UserAccount, bearer_headers
) -> None:
    headers = bearer_headers(researcher)

    assert client.get(f"{ADMIN}/audit-log", headers=headers).status_code == 403
    assert client.get(f"{ADMIN}/audit-log").status_code == 401
    assert client.delete(f"{ADMIN}/audit-log").status_code == 405
