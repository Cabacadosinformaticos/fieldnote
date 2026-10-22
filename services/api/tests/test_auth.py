from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, settings
from app.models import AuditLog, RefreshToken
from app.models.enums import AuditActorType, UserRole
from app.security import passwords, totp
from app.security.passwords import hash_password
from app.security.tokens import create_access_token, decode_access_token, hash_token

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
TOTP_ENROLMENT = "/api/v1/auth/totp/enrolment"
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
    assert body["user"] == {"id": str(user.id), "email": user.email, "role": "researcher"}
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
    assert me.json() == {"id": str(user.id), "email": user.email, "role": "researcher"}


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


def test_administrator_must_enrol_and_then_supply_totp(client: TestClient, make_user) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)

    refused = client.post(
        LOGIN, json={"email": admin.email, "password": "correct horse battery staple"}
    )
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "totp_enrolment_required"

    enrolment = client.post(
        TOTP_ENROLMENT,
        json={"email": admin.email, "password": "correct horse battery staple"},
    )
    assert enrolment.status_code == 200
    secret = enrolment.json()["secret"]
    assert enrolment.json()["otpauth_uri"].startswith("otpauth://totp/")

    missing_code = client.post(
        LOGIN, json={"email": admin.email, "password": "correct horse battery staple"}
    )
    assert missing_code.status_code == 401
    assert missing_code.json()["error"]["code"] == "totp_required"

    code = totp.generate_code(secret)
    accepted = client.post(
        LOGIN,
        json={
            "email": admin.email,
            "password": "correct horse battery staple",
            "totp_code": code,
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["user"]["role"] == "admin"

    wrong_code = "111111" if code != "111111" else "222222"
    rejected = client.post(
        LOGIN,
        json={
            "email": admin.email,
            "password": "correct horse battery staple",
            "totp_code": wrong_code,
        },
    )
    assert rejected.status_code == 401
    assert rejected.json()["error"]["code"] == "invalid_credentials"


def test_password_hashes_use_argon2id_with_the_required_parameters() -> None:
    hashed = hash_password("correct horse battery staple")

    assert hashed.startswith("$argon2id$v=19$m=19456,t=2,p=1$")


def test_production_requires_a_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="", cookie_secure=True)


def test_development_gets_a_local_jwt_secret() -> None:
    development = Settings(environment="development")

    assert development.jwt_secret
