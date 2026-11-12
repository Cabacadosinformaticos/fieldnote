import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    AuditLog,
    Entry,
    PasswordResetToken,
    Prompt,
    RefreshToken,
    StudyMember,
    UserAccount,
)
from app.models.enums import (
    AuditActorType,
    EntryType,
    PromptStatus,
    StudyRole,
    StudyStatus,
    UserRole,
)
from app.security import origin, tokens
from app.security.audit import record
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
        json={
            "email": "  New.Researcher@Example.ORG ",
            "name": "  Sofia Antunes ",
            "role": "researcher",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.researcher@example.org"
    assert body["name"] == "Sofia Antunes"
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
    assert stored.name == "Sofia Antunes"
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
    researcher.name = "Inês Marques"
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
    assert rows["admin@example.org"]["name"] is None
    assert rows["researcher@example.org"]["name"] == "Inês Marques"
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
    owner.name = "Inês Marques"
    member = make_user(email="member@example.org")
    member.name = "Duarte Lopes"
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
    assert {(row["name"], row["email"]) for row in alpha["team"]} == {
        ("Inês Marques", "owner@example.org"),
        ("Duarte Lopes", "member@example.org"),
    }
    assert alpha["schedule_style"] == "balanced"
    assert alpha["participants"] == 1
    assert alpha["active_participants"] == 1
    assert alpha["entries"] == 1
    assert alpha["adherence_percentage"] is None
    assert alpha["adherence_period"] is None
    assert rows["Beta"]["participants"] == 1
    assert rows["Beta"]["entries"] == 0
    assert rows["Beta"]["owner_email"] is None


def test_study_overview_is_admin_only(
    client: TestClient, researcher: UserAccount, bearer_headers
) -> None:
    assert client.get(f"{ADMIN}/studies", headers=bearer_headers(researcher)).status_code == 403


def test_admin_studies_list_shows_adherence_and_active_participants(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study(title="Adherence")
    study.status = StudyStatus.RUNNING
    session.commit()
    participant = make_participant(study, alias="P-01")
    activity = Activity(
        study_id=study.id,
        title="Walk",
        entry_types=[EntryType.TEXT.value],
        prompts_per_day=1,
        window_start=time(8, 0),
        window_end=time(20, 0),
        min_gap_minutes=30,
        expected_minutes=3,
    )
    session.add(activity)
    session.commit()
    today = datetime.now(UTC).astimezone(ZoneInfo("Europe/Lisbon")).date()
    for occurrence, status in enumerate(
        (PromptStatus.ANSWERED, PromptStatus.SENT, PromptStatus.EXPIRED), start=1
    ):
        session.add(
            Prompt(
                participant_id=participant.id,
                activity_id=activity.id,
                plan_date=today,
                occurrence=occurrence,
                status=status,
            )
        )
    session.commit()

    response = client.get(f"{ADMIN}/studies", headers=bearer_headers(admin))

    assert response.status_code == 200
    row = next(item for item in response.json() if item["title"] == "Adherence")
    assert row["status"] == "running"
    assert row["schedule_style"] == "balanced"
    assert row["participants"] == 1
    assert row["active_participants"] == 1
    assert row["adherence_percentage"] == 33.3
    assert row["adherence_period"] == "today"


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
    assert first["total"] == 5
    assert first["page_count"] == 3

    second = client.get(
        f"{ADMIN}/audit-log?limit=2&cursor={first['next_cursor']}", headers=headers
    ).json()
    assert [row["id"] for row in second["items"]] == [events[2].id, events[1].id]
    assert second["next_cursor"] == events[1].id
    assert second["total"] == 5
    assert second["page_count"] == 3

    last = client.get(
        f"{ADMIN}/audit-log?limit=2&cursor={second['next_cursor']}", headers=headers
    ).json()
    assert [row["id"] for row in last["items"]] == [events[0].id]
    assert last["next_cursor"] is None
    assert last["total"] == 5
    assert last["page_count"] == 3


def test_audit_log_searches_by_person_pseudonym_and_study(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study(title="Pequenos-almoços em casa")
    owner = make_user(email="owner@example.org")
    owner.name = "Inês Marques"
    participant = make_participant(study, alias="P-14")
    session.commit()
    base = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    _add_event(
        session,
        "study_updated",
        at=base,
        target=str(study.id),
        details={"study_id": str(study.id)},
    )
    _add_event(session, "login", at=base + timedelta(minutes=1), actor_id=owner.id)
    _add_event(
        session,
        "erasure_requested",
        at=base + timedelta(minutes=2),
        actor_type=AuditActorType.PARTICIPANT,
        actor_id=participant.id,
    )
    _add_event(
        session,
        "login_failed",
        at=base + timedelta(minutes=3),
        details={"email": "unknown@example.org"},
    )
    headers = bearer_headers(admin)

    def search(term: str) -> list[str]:
        response = client.get(f"{ADMIN}/audit-log", params={"q": term}, headers=headers)
        assert response.status_code == 200, response.text
        return [row["action"] for row in response.json()["items"]]

    assert search("Inês") == ["login"]
    assert search("owner@example.org") == ["login"]
    assert search("unknown@example.org") == ["login_failed"]
    assert search("P-14") == ["erasure_requested"]
    assert search("Pequenos") == ["erasure_requested", "study_updated"]
    assert search("nothing-matches") == []


def test_team_request_stores_the_address_and_browser_and_the_actor_name(
    client: TestClient,
    session: Session,
    admin: UserAccount,
    bearer_headers,
    sent_links: list[tuple[str, str]],
) -> None:
    admin.name = "Carla Nunes"
    session.commit()
    headers = {
        **bearer_headers(admin),
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "X-Forwarded-For": "203.0.113.41, 10.0.0.9",
    }

    created = client.post(f"{ADMIN}/accounts", headers=headers, json={"email": "new@example.org"})
    assert created.status_code == 201, created.text

    event = session.scalar(
        select(AuditLog).where(AuditLog.action == "account_created").order_by(AuditLog.id.desc())
    )
    assert event is not None
    assert event.origin_client == "portal"
    assert event.origin_ip == "203.0.113.41"
    assert event.origin_browser == "Chrome"

    page = client.get(
        f"{ADMIN}/audit-log?action=account_created", headers=bearer_headers(admin)
    ).json()
    row = page["items"][0]
    assert row["actor_name"] == "Carla Nunes"
    assert row["origin_client"] == "portal"
    assert row["origin_ip"] == "203.0.113.41"
    assert row["origin_browser"] == "Chrome"


def test_failed_portal_sign_in_keeps_the_address_and_browser(
    client: TestClient, session: Session
) -> None:
    response = client.post(
        LOGIN,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0"
            ),
            "X-Forwarded-For": "192.0.2.88",
        },
        json={"email": "nobody@example.org", "password": "wrong"},
    )

    assert response.status_code == 401
    event = session.scalar(
        select(AuditLog).where(AuditLog.action == "login_failed").order_by(AuditLog.id.desc())
    )
    assert event is not None
    assert event.actor_id is None
    assert event.actor_type == AuditActorType.USER
    assert event.origin_client == "portal"
    assert event.origin_ip == "192.0.2.88"
    assert event.origin_browser == "Firefox"


def test_participant_request_keeps_no_address_or_browser(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    make_participant(study, device_token="device-token", alias="P-14")

    response = client.post(
        f"{API}/participation/me/erasure",
        headers={
            "Authorization": "Device device-token",
            "User-Agent": (
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
            ),
            "X-Forwarded-For": "198.51.100.84",
        },
        json={"confirmation": "APAGAR"},
    )

    assert response.status_code == 200, response.text
    event = session.scalar(
        select(AuditLog).where(AuditLog.action == "erasure_requested").order_by(AuditLog.id.desc())
    )
    assert event is not None
    assert event.origin_client == "app_android"
    assert event.origin_ip is None
    assert event.origin_browser is None


def test_system_row_outside_a_request_uses_the_process_origin(session: Session) -> None:
    token = origin.set_process_client(origin.SCHEDULED_TASK)
    try:
        event = record(session, None, "plan_completed")
        session.commit()
    finally:
        origin.reset_process_client(token)

    assert event.origin_client == "scheduled_task"
    assert event.origin_ip is None
    assert event.origin_browser is None


def test_audit_log_is_admin_only_and_read_only(
    client: TestClient, researcher: UserAccount, bearer_headers
) -> None:
    headers = bearer_headers(researcher)

    assert client.get(f"{ADMIN}/audit-log", headers=headers).status_code == 403
    assert client.get(f"{ADMIN}/audit-log").status_code == 401
    assert client.delete(f"{ADMIN}/audit-log").status_code == 405
