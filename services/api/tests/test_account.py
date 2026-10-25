"""The optional participant account: creation, methods, restore, deletion."""

import re
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AccountDeviceToken,
    AccountEmailCode,
    AccountParticipation,
    AuditLog,
    Participant,
    ParticipantAccount,
    PoolInvitation,
    PoolMember,
)
from app.models.enums import (
    AuditActorType,
    ParticipantStatus,
    PoolInvitationStatus,
)
from app.security import passwords
from app.services import account as account_service
from app.services import mail

BASE = "/api/v1/account"
RECOVERY = f"{BASE}/recovery"
CONFIRM = f"{BASE}/confirm"
SIGN_IN = f"{BASE}/sign-in/recovery"
EMAIL_CODES = f"{BASE}/email/codes"
EMAIL_VERIFY = f"{BASE}/email/verify"
ME = f"{BASE}/me"
LINK = f"{BASE}/participations/link"
METHODS = f"{BASE}/methods"
PARTICIPATION_ME = "/api/v1/participation/me"
ERASURE_CANCEL = "/api/v1/participation/me/erasure/cancel"


def _account(token: str) -> dict[str, str]:
    return {"Authorization": f"Account {token}"}


def _device(token: str) -> dict[str, str]:
    return {"Authorization": f"Device {token}"}


@pytest.fixture(autouse=True)
def _fast_checks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(account_service.settings, "account_failure_delay_seconds", 0.0)
    account_service.reset_rate_limits()
    yield
    account_service.reset_rate_limits()


@pytest.fixture
def sent_mail(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(mail, "send_email_code", lambda to, code: sent.append((to, code)))
    return sent


def _create_recovery(client: TestClient) -> dict[str, object]:
    response = client.post(RECOVERY)
    assert response.status_code == 201
    return response.json()


def _confirm(
    client: TestClient,
    token: str,
    *,
    device_tokens: list[str] | None = None,
    pool_credential: str | None = None,
):
    return client.post(
        CONFIRM,
        json={
            "device_tokens": device_tokens or [],
            "pool_credential": pool_credential,
        },
        headers=_account(token),
    )


def _request_email_code(client: TestClient, email: str, token: str | None = None) -> None:
    headers = _account(token) if token is not None else {}
    response = client.post(EMAIL_CODES, json={"email": email}, headers=headers)
    assert response.status_code == 202, response.text


def test_recovery_account_returns_the_code_once_and_stores_only_a_hash_and_lookup(
    client: TestClient, session: Session
) -> None:
    body = _create_recovery(client)
    code = body["recovery_code"]

    assert body["confirmed"] is False
    assert re.fullmatch(r"[0-9A-Z]{4}(-[0-9A-Z]{4}){3}", code)

    account = session.scalar(select(ParticipantAccount))
    assert account is not None
    assert account.recovery_hash is not None and account.recovery_hash.startswith("$argon2id$")
    assert account.recovery_lookup == account_service._recovery_lookup(code)
    assert code not in account.recovery_hash
    assert code not in account.recovery_lookup

    me = client.get(ME, headers=_account(body["account_token"]))
    assert me.status_code == 200
    assert me.json()["confirmed"] is False
    assert me.json()["methods"] == {
        "recovery_code": True,
        "email_masked": None,
        "google": False,
    }


def test_confirmation_links_the_participations_of_the_phone(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="phone-token", alias="P-01")
    created = _create_recovery(client)

    response = _confirm(client, created["account_token"], device_tokens=["phone-token"])

    assert response.status_code == 200
    body = response.json()
    assert body["confirmed"] is True
    assert body["participations"][0]["participant_id"] == str(participant.id)
    assert body["participations"][0]["study"]["title"] == study.title

    account = session.scalar(select(ParticipantAccount))
    link = session.get(AccountParticipation, participant.id)
    assert link is not None and link.account_id == account.id
    assert client.get(PARTICIPATION_ME, headers=_device("phone-token")).status_code == 200

    audit = session.scalar(select(AuditLog).where(AuditLog.action == "account_created"))
    assert audit is not None
    assert audit.actor_type == AuditActorType.PARTICIPANT
    assert audit.actor_id == account.id
    assert audit.target == str(account.id)


def test_recovery_sign_in_restores_a_participation_and_replaces_the_old_token(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="old-phone", alias="P-01")
    created = _create_recovery(client)
    _confirm(client, created["account_token"], device_tokens=["old-phone"])

    response = client.post(
        SIGN_IN,
        json={"code": created["recovery_code"].replace("-", "").lower()},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    restored = body["participations"]
    assert len(restored) == 1
    assert restored[0]["participant_id"] == str(participant.id)
    assert restored[0]["status"] == "active"
    new_token = restored[0]["device_token"]
    assert new_token and new_token != "old-phone"

    assert client.get(PARTICIPATION_ME, headers=_device("old-phone")).status_code == 401
    assert client.get(PARTICIPATION_ME, headers=_device(new_token)).status_code == 200
    sign_in_audit = session.scalar(select(AuditLog).where(AuditLog.action == "account_signed_in"))
    assert sign_in_audit is not None
    assert sign_in_audit.actor_type == AuditActorType.PARTICIPANT


def test_restore_brings_back_a_participation_with_an_erasure_scheduled(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="old-phone", alias="P-01")
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.status_before_erasure = ParticipantStatus.ACTIVE
    participant.erasure_requested_at = datetime.now(UTC)
    participant.erasure_due_at = datetime.now(UTC) + timedelta(days=7)
    session.commit()

    created = _create_recovery(client)
    _confirm(client, created["account_token"], device_tokens=["old-phone"])
    response = client.post(SIGN_IN, json={"code": created["recovery_code"]})

    assert response.status_code == 200
    restored = response.json()["participations"][0]
    assert restored["status"] == "erasure_scheduled"
    assert restored["erasure_due_at"] is not None

    cancel = client.post(ERASURE_CANCEL, headers=_device(restored["device_token"]))
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "active"


def test_an_unknown_recovery_code_runs_a_dummy_verification_and_a_generic_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(passwords, "dummy_verify", lambda code: calls.append(code))
    unknown = account_service.generate_recovery_code()

    response = client.post(SIGN_IN, json={"code": unknown})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_sign_in_code"
    assert calls == [unknown]

    created = _create_recovery(client)
    _confirm(client, created["account_token"])
    wrong = client.post(SIGN_IN, json={"code": account_service.generate_recovery_code()})
    assert wrong.status_code == 401
    assert wrong.json() == response.json()


def test_email_code_creates_the_account_and_links_the_phone(
    client: TestClient,
    session: Session,
    sent_mail: list[tuple[str, str]],
    make_study,
    make_participant,
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="phone-token", alias="P-01")

    response = client.post(EMAIL_CODES, json={"email": "Teresa@Exemplo.PT"})
    assert response.status_code == 202
    assert response.json()["detail"] == account_service.EMAIL_SENT_DETAIL
    assert sent_mail[-1][0] == "teresa@exemplo.pt"
    code = sent_mail[-1][1]
    assert re.fullmatch(r"[0-9]{6}", code)

    verified = client.post(
        EMAIL_VERIFY,
        json={
            "email": "teresa@exemplo.pt",
            "code": code,
            "device_tokens": ["phone-token"],
        },
    )
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["created"] is True
    assert body["participations"][0]["participant_id"] == str(participant.id)
    assert body["participations"][0]["device_token"] != "phone-token"

    account = session.scalar(select(ParticipantAccount))
    assert account is not None and account.confirmed_at is not None
    assert account.email_lookup == account_service._email_lookup("teresa@exemplo.pt")
    assert account.email_encrypted is not None
    assert b"teresa@exemplo.pt" not in account.email_encrypted
    assert account_service.decrypt_email(account.email_encrypted, account.id) == "teresa@exemplo.pt"

    me = client.get(ME, headers=_account(body["account_token"]))
    assert me.status_code == 200
    assert me.json()["methods"]["email_masked"] == "t•••@exemplo.pt"
    assert me.json()["methods"]["recovery_code"] is False

    actions = set(session.scalars(select(AuditLog.action)))
    assert {"account_created", "account_signed_in"} <= actions


def test_email_code_request_answers_the_same_for_known_and_unknown_addresses(
    client: TestClient, session: Session, sent_mail: list[tuple[str, str]]
) -> None:
    unknown = client.post(EMAIL_CODES, json={"email": "nobody@example.org"})
    assert unknown.status_code == 202

    known = "known@example.org"
    account_id = uuid.uuid4()
    session.add(
        ParticipantAccount(
            id=account_id,
            email_lookup=account_service._email_lookup(known),
            email_encrypted=account_service.encrypt_email(known, account_id),
            confirmed_at=datetime.now(UTC),
        )
    )
    session.commit()

    existing = client.post(EMAIL_CODES, json={"email": known})
    assert existing.status_code == unknown.status_code == 202
    assert existing.json() == unknown.json()


def test_email_code_resend_and_attempt_limits(
    client: TestClient,
    session: Session,
    sent_mail: list[tuple[str, str]],
) -> None:
    first = client.post(EMAIL_CODES, json={"email": "limits@example.org"})
    assert first.status_code == 202
    code = sent_mail[-1][1]

    too_soon = client.post(EMAIL_CODES, json={"email": "limits@example.org"})
    assert too_soon.status_code == 429
    assert too_soon.json()["error"]["code"] == "code_requested_too_soon"

    wrong = "000000" if code != "000000" else "111111"
    for expected_attempt in range(1, 6):
        response = client.post(EMAIL_VERIFY, json={"email": "limits@example.org", "code": wrong})
        assert response.status_code == 401
        row = session.scalar(
            select(AccountEmailCode).where(
                AccountEmailCode.email_lookup == account_service._email_lookup("limits@example.org")
            )
        )
        assert row is not None and row.attempts == expected_attempt

    exhausted = client.post(EMAIL_VERIFY, json={"email": "limits@example.org", "code": code})
    assert exhausted.status_code == 401
    assert session.scalar(select(ParticipantAccount)) is None


def test_add_and_remove_an_email_method(
    client: TestClient,
    session: Session,
    sent_mail: list[tuple[str, str]],
) -> None:
    created = _create_recovery(client)
    assert _confirm(client, created["account_token"]).status_code == 200
    headers = _account(created["account_token"])

    _request_email_code(client, "second@example.org", created["account_token"])
    code = sent_mail[-1][1]
    added = client.post(
        EMAIL_VERIFY,
        json={"email": "second@example.org", "code": code},
        headers=headers,
    )
    assert added.status_code == 200, added.text
    assert added.json()["methods"]["email_masked"] == "s•••@example.org"
    assert added.json()["methods"]["recovery_code"] is True

    removed = client.delete(f"{METHODS}/recovery_code", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["methods"]["recovery_code"] is False
    assert removed.json()["methods"]["email_masked"] == "s•••@example.org"

    last = client.delete(f"{METHODS}/email", headers=headers)
    assert last.status_code == 409
    assert last.json()["error"]["code"] == "last_sign_in_method"

    actions = set(session.scalars(select(AuditLog.action)))
    assert {"account_method_added", "account_method_removed"} <= actions


def test_the_last_method_cannot_be_removed(
    client: TestClient,
) -> None:
    created = _create_recovery(client)
    _confirm(client, created["account_token"])

    response = client.delete(f"{METHODS}/recovery_code", headers=_account(created["account_token"]))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "last_sign_in_method"


def test_delete_the_account_keeps_the_participations_working(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    make_participant(study, device_token="phone-token")
    created = _create_recovery(client)
    _confirm(client, created["account_token"], device_tokens=["phone-token"])
    account = session.scalar(select(ParticipantAccount))

    response = client.delete(BASE, headers=_account(created["account_token"]))

    assert response.status_code == 204
    assert session.get(ParticipantAccount, account.id) is None
    assert session.scalar(select(AccountDeviceToken)) is None
    assert session.scalar(select(AccountParticipation)) is None
    assert client.get(ME, headers=_account(created["account_token"])).status_code == 401
    assert client.get(PARTICIPATION_ME, headers=_device("phone-token")).status_code == 200
    audit = session.scalar(select(AuditLog).where(AuditLog.action == "account_deleted"))
    assert audit is not None and audit.actor_id == account.id


def test_delete_with_the_option_schedules_every_study_and_deletes_the_pool_member(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    first = make_study(title="First")
    second = make_study(title="Second")
    one = make_participant(first, device_token="first-phone", alias="P-01")
    two = make_participant(second, device_token="second-phone", alias="P-01")

    joined = client.post(
        "/api/v1/pool/members",
        json={"concelho": "Lisboa"},
    )
    assert joined.status_code == 201
    pool_credential = joined.json()["credential"]
    member = session.scalar(select(PoolMember))
    invitation = PoolInvitation(
        study_id=first.id,
        pool_member_id=member.id,
        status=PoolInvitationStatus.SENT,
        sent_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(invitation)
    session.commit()

    created = _create_recovery(client)
    response = _confirm(
        client,
        created["account_token"],
        device_tokens=["first-phone", "second-phone"],
        pool_credential=pool_credential,
    )
    assert response.status_code == 200
    assert response.json()["pool_linked"] is True

    deleted = client.delete(
        f"{BASE}?erase_study_data=true", headers=_account(created["account_token"])
    )

    assert deleted.status_code == 204
    session.expire_all()
    for participant in (one, two):
        refreshed = session.get(Participant, participant.id)
        assert refreshed is not None
        assert refreshed.status == ParticipantStatus.ERASURE_SCHEDULED
        assert refreshed.status_before_erasure == ParticipantStatus.ACTIVE
        assert refreshed.erasure_due_at is not None
    assert session.scalar(select(PoolMember)) is None
    refreshed_invitation = session.get(PoolInvitation, invitation.id)
    assert refreshed_invitation is not None
    assert refreshed_invitation.pool_member_id is None
    assert (
        session.scalar(select(AuditLog.action).where(AuditLog.action == "erasure_requested"))
        is not None
    )

    assert (
        client.get(PARTICIPATION_ME, headers=_device("first-phone")).json()["status"]
        == "erasure_scheduled"
    )


def test_link_participations_after_the_account_exists(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="later-phone")
    created = _create_recovery(client)
    _confirm(client, created["account_token"])

    response = client.post(
        LINK,
        json={"device_tokens": ["later-phone"]},
        headers=_account(created["account_token"]),
    )

    assert response.status_code == 200
    assert response.json()["participations"][0]["participant_id"] == str(participant.id)
    assert session.get(AccountParticipation, participant.id) is not None


def test_email_sign_in_to_an_existing_account_rotates_the_tokens_again(
    client: TestClient,
    session: Session,
    sent_mail: list[tuple[str, str]],
    make_study,
    make_participant,
) -> None:
    study = make_study()
    make_participant(study, device_token="phone-token")
    _request_email_code(client, "return@example.org")
    first_code = sent_mail[-1][1]
    first = client.post(
        EMAIL_VERIFY,
        json={"email": "return@example.org", "code": first_code, "device_tokens": ["phone-token"]},
    )
    assert first.status_code == 200
    first_token = first.json()["participations"][0]["device_token"]

    for row in session.scalars(select(AccountEmailCode)):
        row.created_at = datetime.now(UTC) - timedelta(minutes=5)
    session.commit()

    _request_email_code(client, "return@example.org")
    second_code = sent_mail[-1][1]
    second = client.post(EMAIL_VERIFY, json={"email": "return@example.org", "code": second_code})

    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created"] is False
    assert len(session.scalars(select(ParticipantAccount)).all()) == 1
    second_token = body["participations"][0]["device_token"]
    assert second_token != first_token
    assert client.get(PARTICIPATION_ME, headers=_device(first_token)).status_code == 401
    assert client.get(PARTICIPATION_ME, headers=_device(second_token)).status_code == 200


def test_account_token_is_required_and_validated(client: TestClient) -> None:
    assert client.get(ME).status_code == 401
    assert client.get(ME, headers={"Authorization": "Account not-a-token"}).status_code == 401
    assert client.get(ME, headers={"Authorization": "Bearer something"}).status_code == 401


def test_email_encryption_uses_a_fresh_nonce_and_rejects_tampering() -> None:
    account_id = uuid.uuid4()
    first = account_service.encrypt_email("person@example.org", account_id)
    second = account_service.encrypt_email("person@example.org", account_id)

    assert first != second
    assert account_service.decrypt_email(first, account_id) == "person@example.org"

    tampered = bytearray(first)
    tampered[-1] ^= 1
    assert account_service.decrypt_email(bytes(tampered), account_id) is None
    assert account_service.decrypt_email(first, uuid.uuid4()) is None


def test_production_refuses_a_missing_or_malformed_email_encryption_key() -> None:
    with pytest.raises(ValidationError):
        account_service.AccountSettings(environment="production", account_email_encryption_key=None)
    with pytest.raises(ValidationError):
        account_service.AccountSettings(account_email_encryption_key="not-base64")


def test_mail_is_sent_through_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: float) -> None:
            captured["server"] = (host, port, timeout)

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *_exc_info: object) -> None:
            return None

        def send_message(self, message) -> None:
            captured["to"] = message["To"]
            captured["subject"] = message["Subject"]
            captured["body"] = message.get_content()

    monkeypatch.setattr(mail.smtplib, "SMTP", FakeSMTP)
    mail.send_email_code("person@example.org", "123456")

    assert captured["to"] == "person@example.org"
    assert "123456" in str(captured["body"])
    assert captured["server"][1] == mail.settings.smtp_port
