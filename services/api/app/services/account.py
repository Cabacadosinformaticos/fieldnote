"""The optional participant account: recovery code, email codes and restore.

No password and no name. The recovery code is stored as an Argon2id hash plus a keyed lookup value
(NFR-75); an email address is stored encrypted plus a keyed lookup value (NFR-76). Account events
are written to the audit log with the account identifier only (NFR-80).

The email address is encrypted with AES-256-GCM under a key kept outside the database, with a
fresh nonce per encryption and the account id authenticated as associated data (NFR-76).
"""

import base64
import binascii
import hashlib
import hmac
import os
import secrets
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    AccountDeviceToken,
    AccountEmailCode,
    AccountParticipation,
    Participant,
    ParticipantAccount,
    PoolMember,
    Prompt,
    Study,
)
from app.models.enums import (
    AuditActorType,
    EmailCodePurpose,
    ParticipantStatus,
    PromptStatus,
)
from app.security import codes, passwords
from app.security.audit import record
from app.services import mail

RECOVERY_CODE_LENGTH = 16
RECOVERY_GROUP_SIZE = 4
ERASURE_DELAY = timedelta(days=7)

GENERIC_SIGN_IN_MESSAGE = "The sign-in code is invalid or has expired."
EMAIL_SENT_DETAIL = "If the address can receive mail, a code was sent."
MAIL_UNAVAILABLE_MESSAGE = "The mail server is unavailable."

# Symbols people confuse when they type the recovery code from paper.
_LOOKALIKES = str.maketrans({"I": "1", "L": "1", "O": "0", "U": "V"})

_EMAIL_BLOB_PREFIX = b"v1"
_EMAIL_NONCE_BYTES = 12
_EMAIL_TAG_BYTES = 16
_EMAIL_KEY_BYTES = 32

# Only used when FIELDNOTE_ENVIRONMENT is not production. Production refuses to start without
# its own base64-encoded 32-byte key.
_DEVELOPMENT_EMAIL_ENCRYPTION_KEY = "ZmllbGRub3RlLWRldmVsb3BtZW50LWVtYWlsLWtleSE="

_FAILURE_WINDOW_SECONDS = 15 * 60


def _decode_email_encryption_key(material: str) -> bytes:
    try:
        key = base64.b64decode(material, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError(
            "FIELDNOTE_ACCOUNT_EMAIL_ENCRYPTION_KEY must be 32 bytes encoded in base64."
        ) from exc
    if len(key) != _EMAIL_KEY_BYTES:
        raise ValueError(
            "FIELDNOTE_ACCOUNT_EMAIL_ENCRYPTION_KEY must be 32 bytes encoded in base64."
        )
    return key


class AccountSettings(BaseSettings):
    """Settings owned by this module because app/config.py belongs to another worker."""

    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    environment: str = "development"

    # Keys are Compose secrets in a real deployment; the defaults are development values only.
    account_recovery_lookup_key: str = "fieldnote-development-recovery-lookup-key"
    account_email_lookup_key: str = "fieldnote-development-email-lookup-key"
    account_email_encryption_key: str | None = None

    account_failure_delay_seconds: float = 0.2
    account_max_failures_per_ip: int = 30
    account_max_failures_per_account: int = 10

    account_email_code_minutes: int = 10
    account_email_code_attempts: int = 5
    account_email_resend_seconds: int = 60
    account_email_codes_per_hour: int = 5

    @model_validator(mode="after")
    def _resolve_email_encryption_key(self) -> "AccountSettings":
        if not self.account_email_encryption_key:
            if self.environment.strip().lower() == "production":
                raise ValueError(
                    "FIELDNOTE_ACCOUNT_EMAIL_ENCRYPTION_KEY is required when "
                    "FIELDNOTE_ENVIRONMENT is production."
                )
            self.account_email_encryption_key = _DEVELOPMENT_EMAIL_ENCRYPTION_KEY
        _decode_email_encryption_key(self.account_email_encryption_key)
        return self


settings = AccountSettings()

# Failed checks are counted in memory per IP and per account. The delay makes a guessed code
# slower without ever telling a caller whether the lookup matched (NFR-75).
_failures: dict[str, deque[float]] = {}
_failures_lock = threading.Lock()


@dataclass(frozen=True)
class RestoredParticipation:
    participant: Participant
    device_token: str


@dataclass(frozen=True)
class SignInResult:
    account_token: str
    participations: list[RestoredParticipation]
    pool_member: PoolMember | None
    pool_credential: str | None
    created: bool = False


def reset_rate_limits() -> None:
    """Clear the in-memory counters; the tests use it between cases."""
    with _failures_lock:
        _failures.clear()


def _prune(key: str, now: float) -> None:
    queue = _failures.get(key)
    if queue is None:
        return
    while queue and now - queue[0] > _FAILURE_WINDOW_SECONDS:
        queue.popleft()
    if not queue:
        _failures.pop(key, None)


def _note_failure(key: str) -> int:
    now = time.monotonic()
    with _failures_lock:
        _failures.setdefault(key, deque()).append(now)
        _prune(key, now)
        if len(_failures) > 10_000:
            _failures.clear()
        return len(_failures.get(key, ()))


def _failure_count(key: str) -> int:
    now = time.monotonic()
    with _failures_lock:
        _prune(key, now)
        return len(_failures.get(key, ()))


def _clear_failures(key: str) -> None:
    with _failures_lock:
        _failures.pop(key, None)


def _check_limits(ip: str, account_id: object | None) -> None:
    if _failure_count(f"ip:{ip}") >= settings.account_max_failures_per_ip:
        raise ApiError(429, "too_many_attempts", "Too many attempts. Try again later.")
    if account_id is not None and (
        _failure_count(f"account:{account_id}") >= settings.account_max_failures_per_account
    ):
        raise ApiError(429, "too_many_attempts", "Too many attempts. Try again later.")


def _fail(ip: str, account_id: object | None) -> None:
    count = _note_failure(f"ip:{ip}")
    if account_id is not None:
        count = max(count, _note_failure(f"account:{account_id}"))
    delay = min(count, 5) * settings.account_failure_delay_seconds
    if delay > 0:
        time.sleep(delay)
    raise ApiError(401, "invalid_sign_in_code", GENERIC_SIGN_IN_MESSAGE)


def _key(material: str) -> bytes:
    return hashlib.sha256(material.encode("utf-8")).digest()


def _email_code_key() -> bytes:
    return _key(settings.account_email_lookup_key + ":code")


def generate_recovery_code() -> str:
    raw = "".join(secrets.choice(codes.ALPHABET) for _ in range(RECOVERY_CODE_LENGTH))
    return "-".join(
        raw[index : index + RECOVERY_GROUP_SIZE]
        for index in range(0, RECOVERY_CODE_LENGTH, RECOVERY_GROUP_SIZE)
    )


def normalize_recovery_code(typed: str) -> str | None:
    compact = "".join(ch for ch in typed.upper() if ch.isalnum()).translate(_LOOKALIKES)
    if len(compact) != RECOVERY_CODE_LENGTH or any(ch not in codes.ALPHABET for ch in compact):
        return None
    return "-".join(
        compact[index : index + RECOVERY_GROUP_SIZE]
        for index in range(0, RECOVERY_CODE_LENGTH, RECOVERY_GROUP_SIZE)
    )


def _recovery_lookup(canonical: str) -> str:
    return hmac.new(
        _key(settings.account_recovery_lookup_key), canonical.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _email_lookup(email: str) -> str:
    return hmac.new(
        _key(settings.account_email_lookup_key),
        _normalise_email(email).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _email_code_hash(lookup: str, code: str) -> str:
    return hmac.new(_email_code_key(), f"{lookup}:{code}".encode(), hashlib.sha256).hexdigest()


def _email_encryption_key() -> bytes:
    material = settings.account_email_encryption_key
    if material is None:
        raise RuntimeError("The email encryption key is not configured.")
    return _decode_email_encryption_key(material)


def _email_aad(account_id: uuid.UUID | str | None) -> bytes:
    return b"" if account_id is None else str(account_id).encode("ascii")


def encrypt_email(email: str, account_id: uuid.UUID | str | None) -> bytes:
    """AES-256-GCM with a fresh 96-bit nonce; the account id is authenticated as AAD."""
    nonce = os.urandom(_EMAIL_NONCE_BYTES)
    ciphertext = AESGCM(_email_encryption_key()).encrypt(
        nonce, email.encode("utf-8"), _email_aad(account_id)
    )
    return _EMAIL_BLOB_PREFIX + nonce + ciphertext


def decrypt_email(blob: bytes | None, account_id: uuid.UUID | str | None) -> str | None:
    if blob is None:
        return None
    prefix_length = len(_EMAIL_BLOB_PREFIX)
    if len(blob) < prefix_length + _EMAIL_NONCE_BYTES + _EMAIL_TAG_BYTES:
        return None
    if not blob.startswith(_EMAIL_BLOB_PREFIX):
        return None
    nonce = blob[prefix_length : prefix_length + _EMAIL_NONCE_BYTES]
    ciphertext = blob[prefix_length + _EMAIL_NONCE_BYTES :]
    try:
        plaintext = AESGCM(_email_encryption_key()).decrypt(
            nonce, ciphertext, _email_aad(account_id)
        )
    except InvalidTag:
        return None
    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError:
        return None


def mask_email(email: str | None) -> str | None:
    if not email:
        return None
    local, _, domain = email.partition("@")
    return f"{local[:1]}•••@{domain}"


def _audit_account(session: Session, account: ParticipantAccount, action: str) -> None:
    """Write an account event with the actor type participant and the account id only."""
    entry = record(
        session,
        None,
        action,
        target=str(account.id),
        actor_type=AuditActorType.PARTICIPANT,
    )
    entry.actor_id = account.id


def _issue_account_token(session: Session, account: ParticipantAccount, now: datetime) -> str:
    raw = codes.generate_device_token()
    session.add(
        AccountDeviceToken(
            account_id=account.id,
            token_hash=codes.hash_device_token(raw),
            created_at=now,
        )
    )
    return raw


def _member_for_credential(session: Session, raw_credential: str) -> PoolMember | None:
    digest = codes.hash_device_token(raw_credential.strip())
    member = session.scalar(select(PoolMember).where(PoolMember.credential_hash == digest))
    if member is None or member.credential_hash is None:
        return None
    return member if codes.same_hash(member.credential_hash, digest) else None


def member_for_account(session: Session, account: ParticipantAccount) -> PoolMember | None:
    return session.scalar(select(PoolMember).where(PoolMember.account_id == account.id))


def _participants_for_tokens(session: Session, device_tokens: list[str]) -> list[Participant]:
    digests = [
        codes.hash_device_token(token.strip())
        for token in dict.fromkeys(device_tokens)
        if token.strip()
    ]
    if not digests:
        return []
    return list(
        session.scalars(select(Participant).where(Participant.device_token_hash.in_(digests)))
    )


def _link(
    session: Session,
    account: ParticipantAccount,
    device_tokens: list[str],
    pool_credential: str | None,
) -> None:
    for participant in _participants_for_tokens(session, device_tokens):
        if session.get(AccountParticipation, participant.id) is not None:
            continue
        same_study = session.scalar(
            select(AccountParticipation).where(
                AccountParticipation.account_id == account.id,
                AccountParticipation.study_id == participant.study_id,
            )
        )
        if same_study is not None:
            continue
        session.add(
            AccountParticipation(
                participant_id=participant.id,
                account_id=account.id,
                study_id=participant.study_id,
            )
        )
    if pool_credential:
        member = _member_for_credential(session, pool_credential)
        if member is not None and member.account_id in (None, account.id):
            member.account_id = account.id
    session.flush()


def linked_participations(
    session: Session, account: ParticipantAccount
) -> list[tuple[Participant, Study]]:
    rows = session.execute(
        select(Participant, Study)
        .join(AccountParticipation, AccountParticipation.participant_id == Participant.id)
        .join(Study, Study.id == Participant.study_id)
        .where(AccountParticipation.account_id == account.id)
        .order_by(Study.title, Participant.id)
    ).all()
    return [(participant, study) for participant, study in rows]


def create_recovery_account(
    session: Session,
) -> tuple[ParticipantAccount, str, str]:
    now = datetime.now(UTC)
    code = generate_recovery_code()
    account = ParticipantAccount(
        recovery_hash=passwords.hash_password(code),
        recovery_lookup=_recovery_lookup(code),
        created_at=now,
    )
    session.add(account)
    session.flush()
    token = _issue_account_token(session, account, now)
    session.commit()
    return account, code, token


def confirm_account(
    session: Session,
    account: ParticipantAccount,
    device_tokens: list[str],
    pool_credential: str | None,
) -> ParticipantAccount:
    now = datetime.now(UTC)
    first_time = account.confirmed_at is None
    if first_time:
        account.confirmed_at = now
    _link(session, account, device_tokens, pool_credential)
    if first_time:
        _audit_account(session, account, "account_created")
    session.commit()
    return account


def link_to_account(
    session: Session,
    account: ParticipantAccount,
    device_tokens: list[str],
    pool_credential: str | None,
) -> ParticipantAccount:
    if account.confirmed_at is None:
        raise ApiError(
            409,
            "account_unconfirmed",
            "Confirm that the recovery code was saved before linking participations.",
        )
    _link(session, account, device_tokens, pool_credential)
    session.commit()
    return account


def _restore(
    session: Session,
    account: ParticipantAccount,
    device_tokens: list[str],
    pool_credential: str | None,
    *,
    created: bool = False,
) -> SignInResult:
    now = datetime.now(UTC)
    _link(session, account, device_tokens, pool_credential)
    account_token = _issue_account_token(session, account, now)

    restored: list[RestoredParticipation] = []
    for participant in session.scalars(
        select(Participant)
        .join(AccountParticipation, AccountParticipation.participant_id == Participant.id)
        .where(AccountParticipation.account_id == account.id)
        .order_by(Participant.id)
    ):
        raw = codes.generate_device_token()
        participant.device_token_hash = codes.hash_device_token(raw)
        restored.append(RestoredParticipation(participant=participant, device_token=raw))

    member = member_for_account(session, account)
    new_pool_credential = None
    if member is not None:
        new_pool_credential = codes.generate_device_token()
        member.credential_hash = codes.hash_device_token(new_pool_credential)

    _audit_account(session, account, "account_signed_in")
    session.commit()
    return SignInResult(
        account_token=account_token,
        participations=restored,
        pool_member=member,
        pool_credential=new_pool_credential,
        created=created,
    )


def sign_in_with_recovery(
    session: Session,
    *,
    raw_code: str,
    device_tokens: list[str],
    pool_credential: str | None,
    ip: str,
) -> SignInResult:
    canonical = normalize_recovery_code(raw_code)
    account = None
    if canonical is not None:
        account = session.scalar(
            select(ParticipantAccount)
            .where(ParticipantAccount.recovery_lookup == _recovery_lookup(canonical))
            .with_for_update()
        )

    _check_limits(ip, account.id if account is not None else None)
    if account is None or canonical is None or account.recovery_hash is None:
        passwords.dummy_verify(raw_code)
        _fail(ip, None)
    if not passwords.verify_password(account.recovery_hash, canonical):
        _fail(ip, account.id)
    if account.confirmed_at is None:
        _fail(ip, account.id)

    _clear_failures(f"account:{account.id}")
    return _restore(session, account, device_tokens, pool_credential)


def request_email_code(
    session: Session,
    *,
    email: str,
    account: ParticipantAccount | None,
) -> None:
    now = datetime.now(UTC)
    lookup = _email_lookup(email)

    in_last_hour = session.scalar(
        select(func.count())
        .select_from(AccountEmailCode)
        .where(
            AccountEmailCode.email_lookup == lookup,
            AccountEmailCode.created_at > now - timedelta(hours=1),
        )
    )
    if (in_last_hour or 0) >= settings.account_email_codes_per_hour:
        raise ApiError(
            429, "too_many_codes", "Too many codes were requested for this address. Try later."
        )

    resend_cutoff = now - timedelta(seconds=settings.account_email_resend_seconds)
    latest = session.scalar(
        select(AccountEmailCode)
        .where(
            AccountEmailCode.email_lookup == lookup,
            AccountEmailCode.created_at > resend_cutoff,
        )
        .order_by(AccountEmailCode.created_at.desc())
        .limit(1)
    )
    if latest is not None:
        raise ApiError(
            429,
            "code_requested_too_soon",
            f"Wait {settings.account_email_resend_seconds} seconds before asking for another code.",
        )

    existing = None
    if account is None:
        existing = session.scalar(
            select(ParticipantAccount).where(ParticipantAccount.email_lookup == lookup)
        )

    purpose = EmailCodePurpose.ADD_METHOD if account is not None else EmailCodePurpose.SIGN_IN
    code = f"{secrets.randbelow(1_000_000):06d}"
    session.execute(
        update(AccountEmailCode)
        .where(
            AccountEmailCode.email_lookup == lookup,
            AccountEmailCode.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    code_account_id = (
        account.id if account is not None else (existing.id if existing is not None else None)
    )
    session.add(
        AccountEmailCode(
            account_id=code_account_id,
            email_lookup=lookup,
            email_encrypted=encrypt_email(email, code_account_id),
            purpose=purpose,
            code_hash=_email_code_hash(lookup, code),
            expires_at=now + timedelta(minutes=settings.account_email_code_minutes),
            attempts=0,
            created_at=now,
        )
    )
    try:
        mail.send_email_code(_normalise_email(email), code)
    except mail.MailUnavailable as exc:
        session.rollback()
        raise ApiError(503, "mail_unavailable", MAIL_UNAVAILABLE_MESSAGE) from exc
    session.commit()


def _consume_email_code(
    session: Session,
    *,
    email: str,
    code: str,
    purpose: EmailCodePurpose,
    account_id: object | None,
    ip: str,
) -> AccountEmailCode:
    now = datetime.now(UTC)
    lookup = _email_lookup(email)
    _check_limits(ip, account_id)

    query = select(AccountEmailCode).where(
        AccountEmailCode.email_lookup == lookup,
        AccountEmailCode.purpose == purpose,
        AccountEmailCode.consumed_at.is_(None),
    )
    if account_id is not None:
        query = query.where(AccountEmailCode.account_id == account_id)
    row = session.scalar(query.order_by(AccountEmailCode.created_at.desc()).limit(1))

    if row is None:
        _fail(ip, account_id)
    if row.expires_at <= now or (row.attempts or 0) >= settings.account_email_code_attempts:
        row.consumed_at = now
        session.commit()
        _fail(ip, account_id)
    if not hmac.compare_digest(row.code_hash, _email_code_hash(lookup, code)):
        row.attempts = min((row.attempts or 0) + 1, settings.account_email_code_attempts)
        session.commit()
        _fail(ip, account_id)

    row.consumed_at = now
    row.email_encrypted = None
    return row


def sign_in_with_email(
    session: Session,
    *,
    email: str,
    code: str,
    device_tokens: list[str],
    pool_credential: str | None,
    ip: str,
) -> SignInResult:
    lookup = _email_lookup(email)
    row = _consume_email_code(
        session,
        email=email,
        code=code,
        purpose=EmailCodePurpose.SIGN_IN,
        account_id=None,
        ip=ip,
    )

    now = datetime.now(UTC)
    account = session.scalar(
        select(ParticipantAccount)
        .where(ParticipantAccount.email_lookup == lookup)
        .with_for_update()
    )
    created = False
    if account is None:
        account_id = uuid.uuid4()
        account = ParticipantAccount(
            id=account_id,
            email_lookup=lookup,
            email_encrypted=encrypt_email(email, account_id),
            created_at=now,
            confirmed_at=now,
        )
        session.add(account)
        session.flush()
        _audit_account(session, account, "account_created")
        created = True
    elif account.confirmed_at is None:
        account.confirmed_at = now

    row.account_id = account.id
    _clear_failures(f"account:{account.id}")
    return _restore(session, account, device_tokens, pool_credential, created=created)


def add_email_method(
    session: Session,
    account: ParticipantAccount,
    *,
    email: str,
    code: str,
    ip: str,
) -> ParticipantAccount:
    if account.confirmed_at is None:
        raise ApiError(
            409,
            "account_unconfirmed",
            "Confirm that the recovery code was saved before adding a method.",
        )
    lookup = _email_lookup(email)
    _consume_email_code(
        session,
        email=email,
        code=code,
        purpose=EmailCodePurpose.ADD_METHOD,
        account_id=account.id,
        ip=ip,
    )
    other = session.scalar(
        select(ParticipantAccount).where(
            ParticipantAccount.email_lookup == lookup,
            ParticipantAccount.id != account.id,
        )
    )
    if other is not None:
        session.rollback()
        raise ApiError(409, "email_in_use", "That address already signs in to another account.")
    account.email_lookup = lookup
    account.email_encrypted = encrypt_email(email, account.id)
    _audit_account(session, account, "account_method_added")
    session.commit()
    _clear_failures(f"account:{account.id}")
    return account


def remove_method(session: Session, account: ParticipantAccount, method: str) -> ParticipantAccount:
    present = {
        "recovery_code": account.recovery_hash is not None,
        "email": account.email_lookup is not None,
    }
    if method not in present:
        raise ApiError(404, "method_not_found", "The account has no such sign-in method.")
    if not present[method]:
        raise ApiError(404, "method_not_found", "The account has no such sign-in method.")
    if sum(present.values()) <= 1:
        raise ApiError(
            409,
            "last_sign_in_method",
            "The last sign-in method cannot be removed.",
        )
    if method == "recovery_code":
        account.recovery_hash = None
        account.recovery_lookup = None
    else:
        account.email_encrypted = None
        account.email_lookup = None
    _audit_account(session, account, "account_method_removed")
    session.commit()
    return account


def _schedule_erasure(session: Session, participant: Participant, now: datetime) -> None:
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        return
    due = now + ERASURE_DELAY
    participant.status_before_erasure = participant.status
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_requested_at = now
    participant.erasure_due_at = due
    session.execute(
        delete(Prompt).where(
            Prompt.participant_id == participant.id,
            Prompt.status == PromptStatus.PLANNED,
        )
    )
    record(
        session,
        participant,
        "erasure_requested",
        target=str(participant.id),
        details={"due_at": due.isoformat()},
    )


def delete_account(
    session: Session, account: ParticipantAccount, *, erase_study_data: bool
) -> None:
    now = datetime.now(UTC)
    participants = [participant for participant, _study in linked_participations(session, account)]
    member = member_for_account(session, account)

    if erase_study_data:
        for participant in participants:
            _schedule_erasure(session, participant, now)
        if member is not None:
            session.delete(member)
    elif member is not None:
        member.account_id = None

    _audit_account(session, account, "account_deleted")
    session.delete(account)
    session.commit()
