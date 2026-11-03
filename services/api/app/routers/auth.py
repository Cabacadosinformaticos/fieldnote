"""Sign-in, token rotation, logout and TOTP enrolment for researchers and administrators."""

import hashlib
import threading
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.errors import ApiError, error_response
from app.models import RefreshToken, UserAccount
from app.models.enums import AuditActorType, UserRole
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestOut,
    TokenResponse,
    TotpEnrolmentRequest,
    TotpEnrolmentResponse,
    UserOut,
)
from app.security import passwords, tokens, totp
from app.security.audit import record
from app.security.deps import current_user_allow_password_change
from app.services import password_reset

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS = "Invalid email or password."
ACCOUNT_LOCKED = "Too many failed sign-in attempts. Try again later."
INVALID_REFRESH = "The refresh token is missing or invalid."
PASSWORD_UNCHANGED = "The new password must be different from the current password."

# Failed attempts are counted in memory per submitted email as well, so an unknown address gets
# the same progressive delay as a real account and the response time does not reveal which it is.
_failure_counts: dict[str, int] = {}
_failure_lock = threading.Lock()


def _failure_key(email: str) -> str:
    return hashlib.sha256(email.encode("utf-8")).hexdigest()


def _note_failure(email: str) -> None:
    key = _failure_key(email)
    with _failure_lock:
        count = min(_failure_counts.get(key, 0) + 1, settings.login_failure_delay_max_failures)
        _failure_counts[key] = count
        if len(_failure_counts) > 10_000:
            _failure_counts.clear()
    delay = count * settings.login_failure_delay_seconds
    if delay > 0:
        time.sleep(delay)


def _clear_failures(email: str) -> None:
    with _failure_lock:
        _failure_counts.pop(_failure_key(email), None)


def _audit_login_failure(
    session: Session, user: UserAccount | None, email: str, reason: str
) -> None:
    record(
        session,
        user,
        "login_failed",
        target=str(user.id) if user is not None else None,
        details={"email": email, "reason": reason},
        actor_type=AuditActorType.USER,
    )
    session.commit()


def _register_failure(user: UserAccount) -> bool:
    user.failed_logins += 1
    if user.failed_logins >= settings.login_max_failures:
        user.locked_until = datetime.now(UTC) + timedelta(minutes=settings.login_lockout_minutes)
        return True
    return False


def _authenticate_password(session: Session, email: str, password: str) -> UserAccount:
    user = session.scalar(select(UserAccount).where(UserAccount.email == email))
    if user is None:
        passwords.dummy_verify(password)
        _note_failure(email)
        _audit_login_failure(session, None, email, "unknown_email")
        raise ApiError(401, "invalid_credentials", INVALID_CREDENTIALS)

    now = datetime.now(UTC)
    if user.locked_until is not None and user.locked_until > now:
        _audit_login_failure(session, user, email, "locked")
        raise ApiError(429, "account_locked", ACCOUNT_LOCKED)
    if user.locked_until is not None:
        user.locked_until = None
        user.failed_logins = 0

    if not passwords.verify_password(user.password_hash, password):
        locked = _register_failure(user)
        _note_failure(email)
        _audit_login_failure(session, user, email, "locked" if locked else "bad_password")
        if locked:
            raise ApiError(429, "account_locked", ACCOUNT_LOCKED)
        raise ApiError(401, "invalid_credentials", INVALID_CREDENTIALS)

    _clear_failures(email)
    user.failed_logins = 0
    user.locked_until = None
    return user


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=settings.refresh_cookie_path,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


def _delete_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


def _invalid_refresh_response() -> Response:
    response = error_response(401, "invalid_refresh_token", INVALID_REFRESH)
    _delete_refresh_cookie(response)
    return response


def _token_response(user: UserAccount, access_token: str) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_minutes * 60,
        user=UserOut.model_validate(user),
    )


def _revoke_other_refresh_tokens(session: Session, user: UserAccount, request: Request) -> None:
    """Sign out the other sessions, keeping the family that made this request signed in."""
    statement = update(RefreshToken).where(
        RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
    )
    raw = request.cookies.get(settings.refresh_cookie_name)
    current = tokens.find_refresh_token(session, raw) if raw else None
    if current is not None and current.user_id == user.id:
        statement = statement.where(RefreshToken.family_id != current.family_id)
    session.execute(statement.values(revoked_at=datetime.now(UTC)))


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    email = payload.email.strip().lower()
    user = _authenticate_password(session, email, payload.password)

    if user.role == UserRole.ADMIN:
        if user.totp_secret is None:
            _audit_login_failure(session, user, email, "totp_enrolment_required")
            raise ApiError(
                403,
                "totp_enrolment_required",
                "The administrator must enrol a TOTP authenticator first.",
            )
        if not payload.totp_code:
            _audit_login_failure(session, user, email, "totp_missing")
            raise ApiError(401, "totp_required", "A TOTP code is required.")
        if not totp.verify_code(user.totp_secret, payload.totp_code):
            locked = _register_failure(user)
            _note_failure(email)
            _audit_login_failure(session, user, email, "bad_totp")
            if locked:
                raise ApiError(429, "account_locked", ACCOUNT_LOCKED)
            raise ApiError(401, "invalid_credentials", INVALID_CREDENTIALS)

    raw_refresh, _ = tokens.create_refresh_token(session, user.id)
    access_token = tokens.create_access_token(user)
    record(
        session,
        user,
        "login",
        target=str(user.id),
        details={"role": user.role.value},
    )
    session.commit()

    _set_refresh_cookie(response, raw_refresh)
    return _token_response(user, access_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse | Response:
    raw = request.cookies.get(settings.refresh_cookie_name)
    if not raw:
        return _invalid_refresh_response()

    try:
        new_raw, row = tokens.rotate_refresh_token(session, raw)
    except tokens.RefreshTokenReuse as exc:
        user = session.get(UserAccount, exc.user_id)
        record(
            session,
            user,
            "refresh_reuse_detected",
            target=str(exc.family_id),
            actor_type=AuditActorType.USER if user is not None else AuditActorType.SYSTEM,
        )
        session.commit()
        return _invalid_refresh_response()
    except tokens.InvalidRefreshToken:
        session.rollback()
        return _invalid_refresh_response()

    user = session.get(UserAccount, row.user_id)
    if user is None:
        session.rollback()
        return _invalid_refresh_response()

    access_token = tokens.create_access_token(user)
    session.commit()
    _set_refresh_cookie(response, new_raw)
    return _token_response(user, access_token)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    raw = request.cookies.get(settings.refresh_cookie_name)
    if raw:
        row = tokens.revoke_family_for_token(session, raw)
        if row is not None:
            user = session.get(UserAccount, row.user_id)
            record(
                session,
                user,
                "logout",
                target=str(row.family_id),
                actor_type=AuditActorType.USER if user is not None else AuditActorType.SYSTEM,
            )
            session.commit()
    _delete_refresh_cookie(response)


@router.post("/password-reset/request", status_code=202, response_model=PasswordResetRequestOut)
def request_password_reset(
    payload: PasswordResetRequest,
    session: Annotated[Session, Depends(get_session)],
) -> PasswordResetRequestOut:
    """Start the recovery flow. The answer never says whether the email has an account."""
    password_reset.request_reset(session, payload.email)
    return PasswordResetRequestOut(message=password_reset.GENERIC_MESSAGE)


@router.post("/password-reset/confirm", status_code=204)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    password_reset.confirm_reset(session, payload.token, payload.new_password)


@router.post("/password/change", status_code=204)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    user: Annotated[UserAccount, Depends(current_user_allow_password_change)],
) -> None:
    """Change the signed-in account's password; a temporary password can do this too."""
    # A wrong current password follows the same path as a failed sign-in: counted, audited and
    # locked after the same number of attempts.
    _authenticate_password(session, user.email, payload.current_password)
    passwords.validate_new_password(payload.new_password, user.email)
    if passwords.verify_password(user.password_hash, payload.new_password):
        raise ApiError(422, "password_unchanged", PASSWORD_UNCHANGED)

    user.password_hash = passwords.hash_password(payload.new_password)
    user.must_change_password = False
    _revoke_other_refresh_tokens(session, user, request)
    record(
        session,
        user,
        "password_changed",
        target=str(user.id),
        details={"email": user.email},
    )
    session.commit()


@router.get("/me", response_model=UserOut)
def me(
    user: Annotated[UserAccount, Depends(current_user_allow_password_change)],
) -> UserAccount:
    return user


@router.post("/totp/enrolment", response_model=TotpEnrolmentResponse)
def enrol_totp(
    payload: TotpEnrolmentRequest,
    session: Annotated[Session, Depends(get_session)],
) -> TotpEnrolmentResponse:
    email = payload.email.strip().lower()
    user = _authenticate_password(session, email, payload.password)

    if user.role != UserRole.ADMIN:
        raise ApiError(403, "totp_not_applicable", "Only administrators use TOTP.")
    if user.totp_secret is not None:
        raise ApiError(409, "totp_already_enrolled", "TOTP is already enrolled for this account.")

    secret = totp.generate_secret()
    user.totp_secret = secret
    record(session, user, "totp_enrolment", target=str(user.id))
    session.commit()
    return TotpEnrolmentResponse(
        secret=secret, otpauth_uri=totp.provisioning_uri(secret, user.email)
    )
