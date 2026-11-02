"""Researcher password recovery, by single-use token sent to the account email."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import PasswordResetToken, RefreshToken, UserAccount
from app.models.enums import UserRole
from app.security import passwords, tokens
from app.security.audit import record
from app.services import mail

RESET_TOKEN_LIFETIME = timedelta(hours=1)
GENERIC_MESSAGE = "If the email belongs to a researcher account, a recovery message has been sent."
INVALID_TOKEN_MESSAGE = "The recovery token is invalid or has expired."


def _find_user(session: Session, email: str) -> UserAccount | None:
    normalised = email.strip().lower()
    return session.scalar(select(UserAccount).where(func.lower(UserAccount.email) == normalised))


def request_reset(session: Session, email: str) -> None:
    """Create and mail a recovery token, answering the same way for every address."""
    user = _find_user(session, email)
    if user is None or user.role != UserRole.RESEARCHER:
        # Spend the same Argon2id work as a real account would before failing to find a token.
        passwords.dummy_verify(email)
        return

    raw = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=tokens.hash_token(raw),
            expires_at=now + RESET_TOKEN_LIFETIME,
        )
    )
    record(
        session,
        user,
        "password_reset_requested",
        target=str(user.id),
        details={"email": user.email},
    )
    try:
        mail.send_password_reset(user.email, raw)
    except mail.MailUnavailable as exc:
        session.rollback()
        raise ApiError(503, "mail_unavailable", "The mail server is unavailable.") from exc
    session.commit()


def _lock_token(session: Session, raw: str) -> PasswordResetToken | None:
    digest = tokens.hash_token(raw)
    return session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == digest).with_for_update()
    )


def confirm_reset(session: Session, raw_token: str, new_password: str) -> uuid.UUID:
    """Set the new password, burn the token and revoke every signed-in session."""
    row = _lock_token(session, raw_token)
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise ApiError(400, "invalid_reset_token", INVALID_TOKEN_MESSAGE)

    user = session.get(UserAccount, row.user_id)
    if user is None:
        raise ApiError(400, "invalid_reset_token", INVALID_TOKEN_MESSAGE)

    user.password_hash = passwords.hash_password(new_password)
    row.used_at = now
    # Links issued before this one stop working as soon as one is used.
    session.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != row.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    record(
        session,
        user,
        "password_reset_completed",
        target=str(user.id),
        details={"email": user.email},
    )
    session.commit()
    return user.id
