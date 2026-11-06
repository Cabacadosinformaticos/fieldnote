"""Single-use links that let an account created by an administrator choose its password."""

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import PasswordResetToken, UserAccount
from app.security import tokens
from app.security.audit import record
from app.services import mail

logger = logging.getLogger(__name__)

LINK_LIFETIME = timedelta(minutes=30)
LINK_WINDOW = timedelta(hours=1)
# Same ceiling as the recovery flow: three messages per account in an hour.
LINKS_PER_HOUR = 3
LINK_LIMIT_MESSAGE = "Too many account links were sent in the last hour."


def send_link(session: Session, actor: UserAccount, user: UserAccount) -> bool:
    """Store and mail one link. Returns False when the mail server could not take it.

    The token row only survives when the message was sent: a link nobody received must not count
    against the hourly limit.
    """
    now = datetime.now(UTC)
    recent = session.scalar(
        select(func.count())
        .select_from(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.created_at > now - LINK_WINDOW,
        )
    )
    if (recent or 0) >= LINKS_PER_HOUR:
        raise ApiError(429, "link_limit_reached", LINK_LIMIT_MESSAGE)

    raw = secrets.token_urlsafe(32)
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=tokens.hash_token(raw),
            expires_at=now + LINK_LIFETIME,
        )
    )
    record(
        session,
        actor,
        "account_link_sent",
        target=str(user.id),
        details={"email": user.email},
    )
    try:
        mail.send_account_link(user.email, raw)
    except mail.MailUnavailable:
        logger.exception("could not send an account link")
        session.rollback()
        record(
            session,
            actor,
            "account_link_failed",
            target=str(user.id),
            details={"email": user.email},
        )
        session.commit()
        return False
    session.commit()
    return True
