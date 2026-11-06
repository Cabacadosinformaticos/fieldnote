"""The optional participant account.

A phone signs in with a recovery code or an email code and receives an account token, sent as
``Authorization: Account <token>``. The recovery code is returned once and never again. Google
sign-in (FR-99) is a production option and is off in the course project, so it is not offered.
"""

import hmac
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import AccountDeviceToken, Participant, ParticipantAccount, PoolMember, Study
from app.schemas.account import (
    AccountConfirmRequest,
    AccountLinkRequest,
    AccountMethodsOut,
    AccountOut,
    AccountParticipationOut,
    EmailCodeRequest,
    EmailCodeSentOut,
    EmailVerifyRequest,
    PoolRestoredOut,
    RecoveryAccountOut,
    RecoverySignInRequest,
    SignInOut,
)
from app.schemas.participation import StudySummaryOut
from app.schemas.pool import PoolMemberOut
from app.security import codes
from app.services import account as service
from app.services import participation as participation_service

router = APIRouter(prefix="/account", tags=["account"])

SessionDep = Annotated[Session, Depends(get_session)]


@dataclass(frozen=True)
class AccountAuth:
    account: ParticipantAccount
    token: AccountDeviceToken


def _resolve_account(session: Session, authorization: str | None) -> AccountAuth:
    scheme, _, raw = (authorization or "").partition(" ")
    token = raw.strip()
    if scheme.lower() != "account" or not token:
        raise ApiError(401, "not_authenticated", "An account token is required.")

    digest = codes.hash_device_token(token)
    row = session.scalar(select(AccountDeviceToken).where(AccountDeviceToken.token_hash == digest))
    if (
        row is None
        or row.token_hash is None
        or not hmac.compare_digest(row.token_hash, digest)
        or row.revoked_at is not None
    ):
        raise ApiError(401, "invalid_account_token", "The account token is invalid.")
    account = session.get(ParticipantAccount, row.account_id)
    if account is None:
        raise ApiError(401, "invalid_account_token", "The account token is invalid.")

    row.last_used_at = datetime.now(UTC)
    session.commit()
    return AccountAuth(account=account, token=row)


def current_account(
    session: SessionDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> AccountAuth:
    return _resolve_account(session, authorization)


def optional_account(
    session: SessionDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> AccountAuth | None:
    if not authorization:
        return None
    return _resolve_account(session, authorization)


AccountDep = Annotated[AccountAuth, Depends(current_account)]
OptionalAccountDep = Annotated[AccountAuth | None, Depends(optional_account)]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _study_summary(session: Session, study: Study) -> StudySummaryOut:
    card = participation_service.study_card(session, study)
    return StudySummaryOut(
        id=study.id,
        title=study.title,
        description=study.description,
        consent_text=study.consent_text,
        status=study.status,
        starts_on=study.starts_on,
        ends_on=study.ends_on,
        timezone=study.timezone,
        team=list(card["team"]),
        max_prompts_per_day=int(card["requests_per_day"]),
    )


def _participation_out(
    session: Session,
    participant: Participant,
    study: Study,
    device_token: str | None = None,
) -> AccountParticipationOut:
    return AccountParticipationOut(
        participant_id=participant.id,
        study=_study_summary(session, study),
        status=participant.status,
        alias=participant.alias,
        erasure_due_at=participant.erasure_due_at,
        device_token=device_token,
    )


def _pool_member_out(member: PoolMember) -> PoolMemberOut:
    return PoolMemberOut(
        concelho=member.concelho,
        freguesia=member.freguesia,
        age_band=member.age_band,
        gender=member.gender,
        occupation=member.occupation,
        usual_transport=member.usual_transport,
        languages=list(member.languages) if member.languages is not None else None,
        invitations_paused=bool(member.invitations_paused),
        joined_at=member.joined_at,
        account_linked=member.account_id is not None,
    )


def _account_out(session: Session, account: ParticipantAccount) -> AccountOut:
    email = service.decrypt_email(account.email_encrypted, account.id)
    return AccountOut(
        confirmed=account.confirmed_at is not None,
        created_at=account.created_at,
        methods=AccountMethodsOut(
            recovery_code=account.recovery_hash is not None,
            email_masked=service.mask_email(email),
            google=False,
        ),
        participations=[
            _participation_out(session, participant, study)
            for participant, study in service.linked_participations(session, account)
        ],
        pool_linked=service.member_for_account(session, account) is not None,
    )


def _sign_in_out(session: Session, result: service.SignInResult) -> SignInOut:
    participations = []
    for restored in result.participations:
        study = session.get(Study, restored.participant.study_id)
        if study is not None:
            participations.append(
                _participation_out(session, restored.participant, study, restored.device_token)
            )
    pool = None
    if result.pool_member is not None and result.pool_credential is not None:
        pool = PoolRestoredOut(
            credential=result.pool_credential,
            member=_pool_member_out(result.pool_member),
        )
    return SignInOut(
        account_token=result.account_token,
        created=result.created,
        participations=participations,
        pool=pool,
    )


@router.post("/recovery", status_code=201, response_model=RecoveryAccountOut)
def create_recovery_account(session: SessionDep) -> RecoveryAccountOut:
    _account, code, token = service.create_recovery_account(session)
    return RecoveryAccountOut(recovery_code=code, account_token=token)


@router.post("/confirm", response_model=AccountOut)
def confirm_account(
    payload: AccountConfirmRequest,
    auth: AccountDep,
    session: SessionDep,
) -> AccountOut:
    service.confirm_account(session, auth.account, payload.device_tokens, payload.pool_credential)
    return _account_out(session, auth.account)


@router.post("/sign-in/recovery", response_model=SignInOut)
def sign_in_with_recovery(
    payload: RecoverySignInRequest,
    request: Request,
    session: SessionDep,
) -> SignInOut:
    result = service.sign_in_with_recovery(
        session,
        raw_code=payload.code,
        device_tokens=payload.device_tokens,
        pool_credential=payload.pool_credential,
        ip=_client_ip(request),
    )
    return _sign_in_out(session, result)


@router.post("/email/codes", status_code=202, response_model=EmailCodeSentOut)
def request_email_code(
    payload: EmailCodeRequest,
    auth: OptionalAccountDep,
    session: SessionDep,
) -> EmailCodeSentOut:
    account = auth.account if auth is not None else None
    if account is not None and account.confirmed_at is None:
        raise ApiError(
            409,
            "account_unconfirmed",
            "Confirm that the recovery code was saved before adding a method.",
        )
    service.request_email_code(session, email=payload.email, account=account)
    return EmailCodeSentOut(detail=service.EMAIL_SENT_DETAIL)


@router.post("/email/verify", response_model=AccountOut | SignInOut)
def verify_email_code(
    payload: EmailVerifyRequest,
    request: Request,
    auth: OptionalAccountDep,
    session: SessionDep,
) -> AccountOut | SignInOut:
    ip = _client_ip(request)
    if auth is not None:
        service.add_email_method(
            session, auth.account, email=payload.email, code=payload.code, ip=ip
        )
        return _account_out(session, auth.account)
    result = service.sign_in_with_email(
        session,
        email=payload.email,
        code=payload.code,
        device_tokens=payload.device_tokens,
        pool_credential=payload.pool_credential,
        ip=ip,
    )
    return _sign_in_out(session, result)


@router.get("/me", response_model=AccountOut)
def get_account(auth: AccountDep, session: SessionDep) -> AccountOut:
    return _account_out(session, auth.account)


@router.post("/participations/link", response_model=AccountOut)
def link_participations(
    payload: AccountLinkRequest,
    auth: AccountDep,
    session: SessionDep,
) -> AccountOut:
    service.link_to_account(session, auth.account, payload.device_tokens, payload.pool_credential)
    return _account_out(session, auth.account)


@router.delete("/methods/{method}", response_model=AccountOut)
def remove_sign_in_method(
    method: Literal["recovery_code", "email"],
    auth: AccountDep,
    session: SessionDep,
) -> AccountOut:
    service.remove_method(session, auth.account, method)
    return _account_out(session, auth.account)


@router.delete("", status_code=204)
def delete_account(
    auth: AccountDep,
    session: SessionDep,
    erase_study_data: bool = False,
) -> None:
    service.delete_account(session, auth.account, erase_study_data=erase_study_data)
