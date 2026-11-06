import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Entry,
    PasswordResetToken,
    RefreshToken,
    StudyMember,
    UserAccount,
)
from app.models.enums import AuditActorType, EntryType, StudyRole, UserRole
from app.security import tokens
from app.security.passwords import verify_password
from app.security.tokens import hash_token
from app.services import mail

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


@pytest.fixture
def sent_links(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_account_link", lambda to, token: sent.append((to, token)))
    return sent


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


def test_create_account_mails_a_link_and_stores_no_usable_password(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
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
    assert body["state"] == "active"
    assert body["locked"] is False
    assert body["studies"] == 0
    assert body["last_session_at"] is None
    assert body["totp_enrolled"] is False
    assert body["mail_sent"] is True
    assert "temporary_password" not in body

    stored = session.scalar(
        select(UserAccount).where(UserAccount.email == "new.researcher@example.org")
    )
    assert stored is not None
    assert str(stored.id) == body["id"]
    assert not verify_password(stored.password_hash, "")
    assert not verify_password(stored.password_hash, "correct horse battery staple")

    token_row = session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == stored.id)
    )
    assert token_row is not None
    assert len(sent_links) == 1
    assert sent_links[0][0] == "new.researcher@example.org"
    assert token_row.token_hash == hash_token(sent_links[0][1])

    for action in ("account_created", "account_link_sent"):
        audit = session.scalar(
            select(AuditLog).where(AuditLog.action == action, AuditLog.target == str(stored.id))
        )
        assert audit is not None
        assert audit.actor_id == admin.id
        assert audit.actor_type == AuditActorType.USER

    login = client.post(LOGIN, json={"email": "new.researcher@example.org", "password": "anything"})
    assert login.status_code == 401


def test_create_account_reports_mail_failure_but_keeps_the_account(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    bearer_headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(to: str, token: str) -> None:
        raise mail.MailUnavailable("down")

    monkeypatch.setattr(mail, "send_account_link", fail)

    response = client.post(
        f"{ADMIN}/accounts",
        headers=bearer_headers(admin),
        json={"email": "no.mail@example.org"},
    )

    assert response.status_code == 201, response.text
    assert response.json()["mail_sent"] is False
    stored = session.scalar(select(UserAccount).where(UserAccount.email == "no.mail@example.org"))
    assert stored is not None
    assert (
        session.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == stored.id))
        is None
    )
    failed = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "account_link_failed", AuditLog.target == str(stored.id)
        )
    )
    assert failed is not None


def test_create_account_refuses_a_duplicate_email_ignoring_case(
    client: TestClient,
    admin: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
) -> None:
    headers = bearer_headers(admin)
    first = client.post(f"{ADMIN}/accounts", headers=headers, json={"email": "ana@example.org"})
    second = client.post(f"{ADMIN}/accounts", headers=headers, json={"email": "ANA@example.org"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "email_in_use"


def test_list_accounts_shows_role_state_studies_and_last_session(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    make_study,
    bearer_headers,
) -> None:
    study = make_study()
    session.add(StudyMember(study_id=study.id, user_id=researcher.id, role=StudyRole.MEMBER))
    seen_at = datetime(2026, 11, 4, 9, 30, tzinfo=UTC)
    session.add(
        AuditLog(
            actor_type=AuditActorType.USER,
            actor_id=researcher.id,
            action="login",
            target=str(researcher.id),
            details={"role": "researcher"},
            at=seen_at,
        )
    )
    session.commit()

    response = client.get(f"{ADMIN}/accounts", headers=bearer_headers(admin))

    assert response.status_code == 200
    rows = {row["email"]: row for row in response.json()}
    assert rows["admin@example.org"]["role"] == "admin"
    assert rows["admin@example.org"]["state"] == "active"
    assert rows["admin@example.org"]["studies"] == 0
    assert rows["researcher@example.org"]["role"] == "researcher"
    assert rows["researcher@example.org"]["state"] == "active"
    assert rows["researcher@example.org"]["locked"] is False
    assert rows["researcher@example.org"]["studies"] == 1
    assert rows["researcher@example.org"]["last_session_at"].startswith("2026-11-04T09:30:00")


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
    assert locked.json()["state"] == "deactivated"
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
    assert unlocked.json()["state"] == "active"
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


def test_an_administrator_cannot_deactivate_their_own_account(
    client: TestClient, admin: UserAccount, bearer_headers
) -> None:
    headers = bearer_headers(admin)

    assert client.post(f"{ADMIN}/accounts/{admin.id}/lock", headers=headers).status_code == 409


def test_send_link_mails_a_single_use_token(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
) -> None:
    response = client.post(
        f"{ADMIN}/accounts/{researcher.id}/send-link", headers=bearer_headers(admin)
    )

    assert response.status_code == 200
    assert response.json() == {"mail_sent": True}
    assert [to for to, _ in sent_links] == [researcher.email]
    raw = sent_links[0][1]
    row = session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == researcher.id)
    )
    assert row is not None
    assert row.token_hash == hash_token(raw)
    assert row.token_hash != raw
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "account_link_sent", AuditLog.target == str(researcher.id)
        )
    )
    assert audit is not None
    assert audit.actor_id == admin.id

    confirmed = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw, "new_password": "a brand new password"},
    )
    assert confirmed.status_code == 204
    replay = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw, "new_password": "another password"},
    )
    assert replay.status_code == 400


def test_send_link_reports_mail_failure_and_stores_no_token(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(to: str, token: str) -> None:
        raise mail.MailUnavailable("down")

    monkeypatch.setattr(mail, "send_account_link", fail)

    response = client.post(
        f"{ADMIN}/accounts/{researcher.id}/send-link", headers=bearer_headers(admin)
    )

    assert response.status_code == 200
    assert response.json() == {"mail_sent": False}
    assert (
        session.scalar(
            select(PasswordResetToken).where(PasswordResetToken.user_id == researcher.id)
        )
        is None
    )
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "account_link_failed",
                AuditLog.target == str(researcher.id),
            )
        )
        is not None
    )


def test_send_link_is_limited_to_three_per_hour(
    client: TestClient,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
) -> None:
    headers = bearer_headers(admin)
    responses = [
        client.post(f"{ADMIN}/accounts/{researcher.id}/send-link", headers=headers)
        for _ in range(4)
    ]

    assert [response.status_code for response in responses] == [200, 200, 200, 429]
    assert responses[-1].json()["error"]["code"] == "link_limit_reached"
    assert len(sent_links) == 3


def test_send_link_refuses_a_deactivated_account(
    client: TestClient,
    admin: UserAccount,
    researcher: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
) -> None:
    headers = bearer_headers(admin)
    assert client.post(f"{ADMIN}/accounts/{researcher.id}/lock", headers=headers).status_code == 200

    response = client.post(f"{ADMIN}/accounts/{researcher.id}/send-link", headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "account_deactivated"
    assert sent_links == []


def test_send_link_to_an_unknown_account_returns_not_found(
    client: TestClient, admin: UserAccount, bearer_headers
) -> None:
    response = client.post(
        f"{ADMIN}/accounts/{uuid.uuid4()}/send-link", headers=bearer_headers(admin)
    )

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
