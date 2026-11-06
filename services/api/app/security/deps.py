"""FastAPI dependencies for researchers, administrators and participants."""

import hmac
import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import Participant, StudyMember, UserAccount
from app.models.enums import StudyRole, UserRole
from app.security import tokens

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class StudyAccess:
    """The authenticated user and their role in the study, if they are a researcher."""

    user: UserAccount
    role: StudyRole | None
    is_admin: bool


def _resolve_user(
    credentials: HTTPAuthorizationCredentials | None, session: Session
) -> UserAccount:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "not_authenticated", "Authentication is required.")
    try:
        claims = tokens.decode_access_token(credentials.credentials)
    except tokens.ExpiredTokenError as exc:
        raise ApiError(
            401, "token_expired", "The access token has expired.", {"WWW-Authenticate": "Bearer"}
        ) from exc
    except tokens.TokenError as exc:
        raise ApiError(
            401, "invalid_token", "The access token is invalid.", {"WWW-Authenticate": "Bearer"}
        ) from exc

    user = session.get(UserAccount, claims.user_id)
    if user is None:
        raise ApiError(
            401, "invalid_token", "The access token is invalid.", {"WWW-Authenticate": "Bearer"}
        )
    return user


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    session: Annotated[Session, Depends(get_session)],
) -> UserAccount:
    return _resolve_user(credentials, session)


def require_admin(
    user: Annotated[UserAccount, Depends(current_user)],
) -> UserAccount:
    if user.role != UserRole.ADMIN:
        raise ApiError(403, "forbidden", "Administrator access is required.")
    return user


def require_study_role(*roles: StudyRole):
    """Allow administrators and study members whose role is in ``roles``.

    With no roles every member of the study is accepted.
    """
    allowed = frozenset(roles)

    def dependency(
        study_id: uuid.UUID,
        user: Annotated[UserAccount, Depends(current_user)],
        session: Annotated[Session, Depends(get_session)],
    ) -> StudyAccess:
        if user.role == UserRole.ADMIN:
            return StudyAccess(user=user, role=None, is_admin=True)
        member = session.get(StudyMember, (study_id, user.id))
        if member is None:
            raise ApiError(403, "forbidden", "You do not have access to this study.")
        if allowed and member.role not in allowed:
            raise ApiError(403, "forbidden", "Your role does not allow this action.")
        return StudyAccess(user=user, role=member.role, is_admin=False)

    return dependency


def current_participant(
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> Participant:
    scheme, _, raw = (authorization or "").partition(" ")
    token = raw.strip()
    if scheme.lower() != "device" or not token:
        raise ApiError(401, "not_authenticated", "A device token is required.")

    digest = tokens.hash_token(token)
    participant = session.scalar(select(Participant).where(Participant.device_token_hash == digest))
    if participant is None or participant.device_token_hash is None:
        raise ApiError(401, "invalid_device_token", "The device token is invalid.")
    if not hmac.compare_digest(participant.device_token_hash, digest):
        raise ApiError(401, "invalid_device_token", "The device token is invalid.")
    return participant
