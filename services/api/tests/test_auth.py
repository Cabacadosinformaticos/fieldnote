import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, settings
from app.models import AuditLog, PasswordResetToken, RefreshToken, UserAccount
from app.models.enums import AuditActorType, UserRole
from app.security import passwords, tokens, totp
from app.security.passwords import hash_password
from app.security.tokens import create_access_token, decode_access_token, hash_token
from app.services import mail

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
TOTP_ENROLMENT = "/api/v1/auth/totp/enrolment"
TOTP_CONFIRM = "/api/v1/auth/totp/enrolment/confirm"
PASSWORD_RESET_REQUEST = "/api/v1/auth/password-reset/request"
PASSWORD_RESET_CONFIRM = "/api/v1/auth/password-reset/confirm"
PASSWORD_CHANGE = "/api/v1/auth/password/change"
STUDIES = "/api/v1/studies"
COOKIE = "fieldnote_refresh"
INVALID_BODY = {"error": {"code": "invalid_credentials", "message": "Invalid email or password."}}


def test_login_returns_an_access_token_and_sets_the_refresh_cookie(
    client: TestClient, make_user
) -> None:
    user = make_user()

    response = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse battery staple"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900
    assert body["user"] == {
        "id": str(user.id),
        "email": user.email,
        "name": None,
        "role": "researcher",
    }
    assert "refresh_token" not in body

    cookie = client.cookies.get(COOKIE)
    assert cookie
    header = response.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "secure" in header
    assert "samesite=strict" in header
    assert "path=/api/v1/auth" in header

    claims = decode_access_token(body["access_token"])
    assert claims.user_id == user.id
    assert timedelta(minutes=14) < claims.expires_at - datetime.now(UTC) <= timedelta(minutes=15)

    me = client.get(ME, headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json() == {
        "id": str(user.id),
        "email": user.email,
        "name": None,
        "role": "researcher",
    }


def test_the_signed_in_user_carries_the_account_name(
    client: TestClient, session: Session, make_user
) -> None:
    user = make_user()
    user.name = "Inês Marques"
    session.commit()

    response = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse battery staple"}
    )

    assert response.status_code == 200
    assert response.json()["user"]["name"] == "Inês Marques"
    me = client.get(ME, headers={"Authorization": f"Bearer {response.json()['access_token']}"})
    assert me.json()["name"] == "Inês Marques"


def test_login_with_a_wrong_password_returns_the_generic_error(
    client: TestClient, make_user
) -> None:
    user = make_user()

    response = client.post(LOGIN, json={"email": user.email, "password": "not the password"})

    assert response.status_code == 401
    assert response.json() == INVALID_BODY


def test_login_with_an_unknown_email_returns_the_same_error_and_runs_a_dummy_verify(
    client: TestClient, make_user, monkeypatch
) -> None:
    user = make_user()
    calls: list[str] = []
    monkeypatch.setattr(passwords, "dummy_verify", calls.append)

    unknown = client.post(
        LOGIN, json={"email": "nobody@example.org", "password": "correct horse battery staple"}
    )
    wrong = client.post(LOGIN, json={"email": user.email, "password": "not the password"})

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json() == INVALID_BODY
    assert calls == ["correct horse battery staple"]


def test_repeated_failures_lock_the_account(client: TestClient, make_user) -> None:
    user = make_user()

    for _ in range(settings.login_max_failures - 1):
        response = client.post(LOGIN, json={"email": user.email, "password": "wrong"})
        assert response.status_code == 401

    fifth = client.post(LOGIN, json={"email": user.email, "password": "wrong"})
    assert fifth.status_code == 429
    assert fifth.json()["error"]["code"] == "account_locked"

    blocked = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse battery staple"}
    )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "account_locked"
    assert user.locked_until is not None
    assert user.locked_until > datetime.now(UTC)


def test_refresh_rotates_the_token_in_the_same_family(
    client: TestClient, session: Session, make_user
) -> None:
    make_user()
    client.post(
        LOGIN, json={"email": "researcher@example.org", "password": "correct horse battery staple"}
    )
    first = client.cookies.get(COOKIE)
    assert first

    response = client.post(REFRESH)

    assert response.status_code == 200
    second = client.cookies.get(COOKIE)
    assert second and second != first
    assert decode_access_token(response.json()["access_token"])

    rows = session.scalars(select(RefreshToken)).all()
    assert len(rows) == 2
    assert len({row.family_id for row in rows}) == 1
    assert all(row.token_hash != first and row.token_hash != second for row in rows)
    assert all(len(row.token_hash) == 64 for row in rows)
    old = next(row for row in rows if row.token_hash == hash_token(first))
    assert old.superseded_at is not None
    assert old.revoked_at is None


def test_reusing_a_superseded_token_revokes_the_family(
    client: TestClient, session: Session, make_user
) -> None:
    make_user()
    client.post(
        LOGIN, json={"email": "researcher@example.org", "password": "correct horse battery staple"}
    )
    first = client.cookies.get(COOKIE)
    assert first
    assert client.post(REFRESH).status_code == 200
    second = client.cookies.get(COOKIE)
    assert second

    client.cookies.clear()
    reused = client.post(REFRESH, headers={"Cookie": f"{COOKIE}={first}"})
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "invalid_refresh_token"

    client.cookies.clear()
    after_reuse = client.post(REFRESH, headers={"Cookie": f"{COOKIE}={second}"})
    assert after_reuse.status_code == 401

    rows = session.scalars(select(RefreshToken)).all()
    assert len(rows) == 2
    assert all(row.revoked_at is not None for row in rows)


def test_expired_access_token_is_refused(client: TestClient, make_user) -> None:
    user = make_user()
    token = create_access_token(user, expires_in=timedelta(seconds=-1))

    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"


def test_audit_log_records_login_and_failed_login(
    client: TestClient, session: Session, make_user
) -> None:
    user = make_user()
    client.post(LOGIN, json={"email": user.email, "password": "correct horse battery staple"})
    client.post(LOGIN, json={"email": user.email, "password": "wrong"})

    rows = session.scalars(select(AuditLog).order_by(AuditLog.id)).all()
    actions = [row.action for row in rows]
    assert "login" in actions
    assert "login_failed" in actions

    login_row = next(row for row in rows if row.action == "login")
    assert login_row.actor_type == AuditActorType.USER
    assert login_row.actor_id == user.id

    failed_row = next(row for row in rows if row.action == "login_failed")
    assert failed_row.actor_type == AuditActorType.USER
    assert failed_row.actor_id == user.id


def test_audit_log_records_a_failed_login_for_an_unknown_email(
    client: TestClient, session: Session
) -> None:
    client.post(LOGIN, json={"email": "nobody@example.org", "password": "whatever"})

    row = session.scalars(select(AuditLog).where(AuditLog.action == "login_failed")).one()
    assert row.actor_type == AuditActorType.USER
    assert row.actor_id is None


def test_logout_revokes_the_refresh_family(client: TestClient, session: Session, make_user) -> None:
    make_user()
    client.post(
        LOGIN, json={"email": "researcher@example.org", "password": "correct horse battery staple"}
    )
    raw = client.cookies.get(COOKIE)
    assert raw

    response = client.post(LOGOUT)

    assert response.status_code == 204
    assert client.cookies.get(COOKIE) is None
    rows = session.scalars(select(RefreshToken)).all()
    assert all(row.revoked_at is not None for row in rows)

    client.cookies.clear()
    refused = client.post(REFRESH, headers={"Cookie": f"{COOKIE}={raw}"})
    assert refused.status_code == 401


def test_administrator_must_enrol_confirm_and_then_supply_totp(
    client: TestClient, session: Session, make_user
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    password = "correct horse battery staple"

    refused = client.post(LOGIN, json={"email": admin.email, "password": password})
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "totp_enrolment_required"

    enrolment = client.post(TOTP_ENROLMENT, json={"email": admin.email, "password": password})
    assert enrolment.status_code == 200
    secret = enrolment.json()["secret"]
    assert enrolment.json()["otpauth_uri"].startswith("otpauth://totp/")

    # A secret that was never checked with a code is not a second factor yet.
    still_unconfirmed = client.post(
        LOGIN,
        json={"email": admin.email, "password": password, "totp_code": totp.generate_code(secret)},
    )
    assert still_unconfirmed.status_code == 403
    assert still_unconfirmed.json()["error"]["code"] == "totp_enrolment_required"

    good_code = totp.generate_code(secret)
    wrong_code = "111111" if good_code != "111111" else "222222"
    bad = client.post(
        TOTP_CONFIRM,
        json={"email": admin.email, "password": password, "totp_code": wrong_code},
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    session.expire_all()
    assert admin.totp_confirmed_at is None

    confirmed = client.post(
        TOTP_CONFIRM,
        json={"email": admin.email, "password": password, "totp_code": good_code},
    )
    assert confirmed.status_code == 204
    session.expire_all()
    assert admin.totp_confirmed_at is not None
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "totp_enrolment_confirmed", AuditLog.actor_id == admin.id
            )
        )
        is not None
    )

    missing_code = client.post(LOGIN, json={"email": admin.email, "password": password})
    assert missing_code.status_code == 401
    assert missing_code.json()["error"]["code"] == "totp_required"

    code = totp.generate_code(secret)
    accepted = client.post(
        LOGIN,
        json={"email": admin.email, "password": password, "totp_code": code},
    )
    assert accepted.status_code == 200
    assert accepted.json()["user"]["role"] == "admin"

    wrong_code = "111111" if code != "111111" else "222222"
    rejected = client.post(
        LOGIN,
        json={"email": admin.email, "password": password, "totp_code": wrong_code},
    )
    assert rejected.status_code == 401
    assert rejected.json()["error"]["code"] == "invalid_credentials"

    again = client.post(TOTP_ENROLMENT, json={"email": admin.email, "password": password})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "totp_already_enrolled"
    again_confirm = client.post(
        TOTP_CONFIRM,
        json={"email": admin.email, "password": password, "totp_code": code},
    )
    assert again_confirm.status_code == 409
    assert again_confirm.json()["error"]["code"] == "totp_already_enrolled"


def test_totp_enrolment_can_be_repeated_until_the_first_code_confirms_it(
    client: TestClient, session: Session, make_user
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    password = "correct horse battery staple"

    first = client.post(TOTP_ENROLMENT, json={"email": admin.email, "password": password})
    second = client.post(TOTP_ENROLMENT, json={"email": admin.email, "password": password})

    assert first.status_code == second.status_code == 200
    assert first.json()["secret"] != second.json()["secret"]
    session.expire_all()
    assert admin.totp_secret == second.json()["secret"]

    good_code = totp.generate_code(second.json()["secret"])
    confirmed = client.post(
        TOTP_CONFIRM,
        json={"email": admin.email, "password": password, "totp_code": good_code},
    )
    assert confirmed.status_code == 204
    login = client.post(
        LOGIN,
        json={"email": admin.email, "password": password, "totp_code": good_code},
    )
    assert login.status_code == 200


def test_totp_confirmation_needs_an_administrator_and_a_started_enrolment(
    client: TestClient, make_user
) -> None:
    password = "correct horse battery staple"
    researcher = make_user(email="researcher@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)

    not_applicable = client.post(
        TOTP_CONFIRM,
        json={"email": researcher.email, "password": password, "totp_code": "123456"},
    )
    assert not_applicable.status_code == 403
    assert not_applicable.json()["error"]["code"] == "totp_not_applicable"

    not_started = client.post(
        TOTP_CONFIRM,
        json={"email": admin.email, "password": password, "totp_code": "123456"},
    )
    assert not_started.status_code == 409
    assert not_started.json()["error"]["code"] == "totp_not_enrolled"


def test_password_reset_request_answers_the_same_for_known_and_unknown_emails(
    client: TestClient, session: Session, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))

    known = client.post(PASSWORD_RESET_REQUEST, json={"email": user.email})
    unknown = client.post(PASSWORD_RESET_REQUEST, json={"email": "nobody@example.org"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert [to for to, _ in sent] == [user.email]

    raw = sent[0][1]
    row = session.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    assert row is not None
    assert row.token_hash == hash_token(raw)
    assert row.token_hash != raw
    assert row.used_at is None
    assert timedelta(minutes=59) < row.expires_at - datetime.now(UTC) <= timedelta(hours=1)


def test_password_reset_request_sends_nothing_to_non_researcher_accounts(
    client: TestClient, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = make_user(email="admin-recovery@example.org", role=UserRole.ADMIN)
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))

    response = client.post(PASSWORD_RESET_REQUEST, json={"email": admin.email})

    assert response.status_code == 202
    assert sent == []


def test_password_reset_confirm_changes_the_password_once_and_revokes_sessions(
    client: TestClient, session: Session, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))

    login = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse battery staple"}
    )
    assert login.status_code == 200
    assert client.cookies.get(COOKIE)

    client.post(PASSWORD_RESET_REQUEST, json={"email": user.email})
    first = sent[-1][1]
    client.post(PASSWORD_RESET_REQUEST, json={"email": user.email})
    second = sent[-1][1]

    response = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": second, "new_password": "a brand new password"}
    )

    assert response.status_code == 204
    session.expire_all()
    assert passwords.verify_password(user.password_hash, "a brand new password")
    tokens = session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all()
    assert tokens
    assert all(token.revoked_at is not None for token in tokens)
    assert client.post(REFRESH).status_code == 401

    actions = set(
        session.scalars(
            select(AuditLog.action).where(
                AuditLog.action.in_(["password_reset_requested", "password_reset_completed"])
            )
        )
    )
    assert actions == {"password_reset_requested", "password_reset_completed"}

    replay = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": second, "new_password": "another password"}
    )
    assert replay.status_code == 400
    assert replay.json()["error"]["code"] == "invalid_reset_token"
    older = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": first, "new_password": "another password"}
    )
    assert older.status_code == 400
    assert older.json()["error"]["code"] == "invalid_reset_token"

    old_login = client.post(LOGIN, json={"email": user.email, "password": "wrong password"})
    assert old_login.status_code == 401
    new_login = client.post(LOGIN, json={"email": user.email, "password": "a brand new password"})
    assert new_login.status_code == 200


def test_password_reset_confirm_rejects_an_expired_token(
    client: TestClient, session: Session, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))
    client.post(PASSWORD_RESET_REQUEST, json={"email": user.email})

    row = session.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    assert row is not None
    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    session.commit()

    response = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": sent[-1][1], "new_password": "new password"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_reset_token"
    session.expire_all()
    assert not passwords.verify_password(user.password_hash, "new password")


def _request_reset_token(client: TestClient, monkeypatch: pytest.MonkeyPatch, email: str) -> str:
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))
    client.post(PASSWORD_RESET_REQUEST, json={"email": email})
    return sent[-1][1]


def test_password_reset_confirm_rejects_a_short_password(
    client: TestClient, session: Session, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    raw = _request_reset_token(client, monkeypatch, user.email)

    response = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": raw, "new_password": "eleven char"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "password_too_short"
    session.expire_all()
    assert passwords.verify_password(user.password_hash, "correct horse battery staple")


def test_password_reset_confirm_rejects_the_email_as_the_password(
    client: TestClient, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    raw = _request_reset_token(client, monkeypatch, user.email)

    response = client.post(
        PASSWORD_RESET_CONFIRM,
        json={"token": raw, "new_password": user.email.upper()},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "password_is_email"


def test_password_reset_confirm_rejects_a_password_over_the_maximum(
    client: TestClient, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    raw = _request_reset_token(client, monkeypatch, user.email)

    response = client.post(
        PASSWORD_RESET_CONFIRM,
        json={"token": raw, "new_password": "a" * (passwords.MAX_PASSWORD_LENGTH + 1)},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "password_too_long"


def test_new_password_rule_accepts_the_minimum_length() -> None:
    passwords.validate_new_password("a" * passwords.MIN_PASSWORD_LENGTH, "researcher@example.org")


def test_login_still_accepts_a_short_password_from_an_old_account(
    client: TestClient, make_user
) -> None:
    user = make_user(password="short")

    response = client.post(LOGIN, json={"email": user.email, "password": "short"})

    assert response.status_code == 200


def test_password_reset_requests_are_limited_to_three_per_hour(
    client: TestClient, session: Session, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = make_user()
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_password_reset", lambda to, token: sent.append((to, token)))

    responses = [client.post(PASSWORD_RESET_REQUEST, json={"email": user.email}) for _ in range(4)]

    assert [response.status_code for response in responses] == [202, 202, 202, 202]
    assert all(response.json() == responses[0].json() for response in responses)
    assert len(sent) == 3
    tokens = session.scalars(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    ).all()
    assert len(tokens) == 3
    audit_rows = session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "password_reset_requested")
    )
    assert audit_rows == 3
    # The refused request wrote no audit row and did not touch the account itself.
    session.expire_all()
    assert user.failed_logins == 0


def test_password_reset_mail_carries_a_dashboard_link(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    def fake_send(to: str, subject: str, body: str) -> None:
        captured.update(to=to, subject=subject, body=body)

    monkeypatch.setattr(mail, "_send", fake_send)

    mail.send_password_reset("researcher@example.org", "raw-token")

    assert captured["to"] == "researcher@example.org"
    link = f"{settings.dashboard_base_url}/recuperar#token=raw-token"
    assert link in captured["body"]
    assert "Use este token" not in captured["body"]


def test_account_creation_mails_a_single_use_link_instead_of_a_password(
    client: TestClient, session: Session, make_user, bearer_headers, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_account_link", lambda to, token: sent.append((to, token)))

    response = client.post(
        "/api/v1/admin/accounts",
        headers=bearer_headers(admin),
        json={"email": "new.researcher@example.org"},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert "temporary_password" not in body
    assert body["mail_sent"] is True
    assert [to for to, _ in sent] == ["new.researcher@example.org"]
    raw = sent[0][1]

    row = session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == uuid.UUID(body["id"]))
    )
    assert row is not None
    assert row.token_hash == hash_token(raw)
    assert row.token_hash != raw
    assert row.used_at is None
    assert timedelta(minutes=29) < row.expires_at - datetime.now(UTC) <= timedelta(minutes=30)

    # The account exists but has no password anyone can type.
    impossible = client.post(LOGIN, json={"email": "new.researcher@example.org", "password": raw})
    assert impossible.status_code == 401
    assert impossible.json()["error"]["code"] == "invalid_credentials"

    chosen = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": raw, "new_password": "a brand new password"}
    )
    assert chosen.status_code == 204
    replay = client.post(
        PASSWORD_RESET_CONFIRM, json={"token": raw, "new_password": "another password"}
    )
    assert replay.status_code == 400
    accepted = client.post(
        LOGIN, json={"email": "new.researcher@example.org", "password": "a brand new password"}
    )
    assert accepted.status_code == 200


def test_password_hashes_use_argon2id_with_the_required_parameters() -> None:
    hashed = hash_password("correct horse battery staple")

    assert hashed.startswith("$argon2id$v=19$m=19456,t=2,p=1$")


def test_production_requires_a_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="", cookie_secure=True)


def test_development_gets_a_local_jwt_secret() -> None:
    development = Settings(environment="development")

    assert development.jwt_secret


def test_password_reset_answers_the_same_when_mail_is_down(
    client: TestClient, make_user, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(to: str, token: str) -> None:
        raise mail.MailUnavailable("down")

    user = make_user()
    monkeypatch.setattr(mail, "send_password_reset", fail)

    response = client.post(PASSWORD_RESET_REQUEST, json={"email": user.email})

    assert response.status_code == 202


def test_changing_a_password_revokes_the_other_sessions(
    client: TestClient, session: Session, make_user
) -> None:
    user = make_user()
    current = "correct horse battery staple"
    new_password = "a different password"
    login = client.post(LOGIN, json={"email": user.email, "password": current})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Two other signed-in sessions, both in families of their own.
    user_id = user.id
    _, other_one = tokens.create_refresh_token(session, user_id)
    _, other_two = tokens.create_refresh_token(session, user_id)
    session.commit()
    other_one_id, other_two_id = other_one.id, other_two.id
    current_row = tokens.find_refresh_token(session, client.cookies.get(COOKIE))
    current_id = current_row.id if current_row is not None else None

    response = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={"current_password": current, "new_password": new_password},
    )

    assert response.status_code == 204
    session.expire_all()
    stored = session.get(UserAccount, user_id)
    assert stored is not None
    assert passwords.verify_password(stored.password_hash, new_password)
    assert not passwords.verify_password(stored.password_hash, current)

    session.expire_all()
    assert session.get(RefreshToken, other_one_id).revoked_at is not None
    assert session.get(RefreshToken, other_two_id).revoked_at is not None
    if current_id is not None:
        assert session.get(RefreshToken, current_id).revoked_at is None

    allowed = client.get(STUDIES, headers=headers)
    assert allowed.status_code == 200
    old_login = client.post(LOGIN, json={"email": user.email, "password": current})
    assert old_login.status_code == 401
    new_login = client.post(LOGIN, json={"email": user.email, "password": new_password})
    assert new_login.status_code == 200

    row = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "password_changed", AuditLog.target == str(user_id)
        )
    )
    assert row is not None
    assert row.details == {"email": user.email}


def test_change_password_rejects_a_wrong_current_password_as_a_failed_sign_in(
    client: TestClient, session: Session, make_user
) -> None:
    user = make_user()
    headers = {"Authorization": f"Bearer {create_access_token(user)}"}

    for _ in range(settings.login_max_failures - 1):
        response = client.post(
            PASSWORD_CHANGE,
            headers=headers,
            json={"current_password": "wrong", "new_password": "a brand new password"},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_credentials"

    locked = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={"current_password": "wrong", "new_password": "a brand new password"},
    )
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "account_locked"
    session.expire_all()
    assert user.locked_until is not None
    assert (
        session.scalar(
            select(AuditLog).where(AuditLog.action == "login_failed", AuditLog.actor_id == user.id)
        )
        is not None
    )


def test_change_password_rejects_the_rules_with_their_codes(client: TestClient, make_user) -> None:
    user = make_user()
    headers = {"Authorization": f"Bearer {create_access_token(user)}"}
    current = "correct horse battery staple"

    short = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={"current_password": current, "new_password": "eleven char"},
    )
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "password_too_short"

    is_email = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={"current_password": current, "new_password": user.email.upper()},
    )
    assert is_email.status_code == 422
    assert is_email.json()["error"]["code"] == "password_is_email"

    unchanged = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={"current_password": current, "new_password": current},
    )
    assert unchanged.status_code == 422
    assert unchanged.json()["error"]["code"] == "password_unchanged"

    too_long = client.post(
        PASSWORD_CHANGE,
        headers=headers,
        json={
            "current_password": current,
            "new_password": "a" * (passwords.MAX_PASSWORD_LENGTH + 1),
        },
    )
    assert too_long.status_code == 422
    assert too_long.json()["error"]["code"] == "password_too_long"
