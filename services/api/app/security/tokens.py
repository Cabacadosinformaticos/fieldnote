"""Access JWTs and opaque refresh tokens with rotation and reuse detection."""

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RefreshToken, UserAccount

ACCESS_TOKEN_ISSUER = "fieldnote-api"


class TokenError(Exception):
    """The access token is invalid."""


class ExpiredTokenError(TokenError):
    """The access token is valid but past its expiry."""


class InvalidRefreshToken(Exception):
    """The refresh token is unknown, expired or revoked."""


class RefreshTokenReuse(Exception):
    """A superseded refresh token was presented and its family was revoked."""

    def __init__(self, family_id: uuid.UUID, user_id: uuid.UUID) -> None:
        super().__init__("refresh token reuse")
        self.family_id = family_id
        self.user_id = user_id


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    role: str
    expires_at: datetime


def _jwt_secret() -> str:
    if not settings.jwt_secret:
        raise RuntimeError("The JWT secret is not configured.")
    return settings.jwt_secret


def create_access_token(user: UserAccount, expires_in: timedelta | None = None) -> str:
    now = datetime.now(UTC)
    lifetime = expires_in or timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "type": "access",
        "iss": ACCESS_TOKEN_ISSUER,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AccessTokenClaims:
    try:
        payload = jwt.decode(
            token,
            _jwt_secret(),
            algorithms=[settings.jwt_algorithm],
            issuer=ACCESS_TOKEN_ISSUER,
            options={"require": ["sub", "type", "iat", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ExpiredTokenError from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError from exc

    if payload.get("type") != "access":
        raise TokenError
    try:
        user_id = uuid.UUID(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise TokenError from exc
    return AccessTokenClaims(
        user_id=user_id,
        role=str(payload.get("role", "")),
        expires_at=datetime.fromtimestamp(int(payload["exp"]), UTC),
    )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_refresh_token(
    session: Session,
    user_id: uuid.UUID,
    family_id: uuid.UUID | None = None,
    expires_in: timedelta | None = None,
) -> tuple[str, RefreshToken]:
    raw = secrets.token_urlsafe(32)
    lifetime = expires_in or timedelta(days=settings.refresh_token_days)
    row = RefreshToken(
        user_id=user_id,
        family_id=family_id or uuid.uuid4(),
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC) + lifetime,
    )
    session.add(row)
    session.flush()
    return raw, row


def find_refresh_token(
    session: Session, raw: str, *, for_update: bool = False
) -> RefreshToken | None:
    digest = hash_token(raw)
    statement = select(RefreshToken).where(RefreshToken.token_hash == digest)
    if for_update:
        statement = statement.with_for_update()
    row = session.scalar(statement)
    if row is None or not hmac.compare_digest(row.token_hash, digest):
        return None
    return row


def revoke_family(session: Session, family_id: uuid.UUID) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def rotate_refresh_token(session: Session, raw: str) -> tuple[str, RefreshToken]:
    row = find_refresh_token(session, raw, for_update=True)
    if row is None:
        raise InvalidRefreshToken
    now = datetime.now(UTC)
    if row.revoked_at is not None or row.expires_at <= now:
        raise InvalidRefreshToken
    if row.superseded_at is not None:
        # Someone kept a copy of a token that was already rotated. Revoke the whole family
        # so the copy of the current token stops working too.
        revoke_family(session, row.family_id)
        raise RefreshTokenReuse(row.family_id, row.user_id)
    row.superseded_at = now
    new_raw, new_row = create_refresh_token(session, row.user_id, family_id=row.family_id)
    return new_raw, new_row


def revoke_family_for_token(session: Session, raw: str) -> RefreshToken | None:
    row = find_refresh_token(session, raw, for_update=True)
    if row is not None:
        revoke_family(session, row.family_id)
    return row
