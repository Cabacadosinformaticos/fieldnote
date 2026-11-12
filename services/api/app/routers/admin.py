"""Administrator screens: researcher accounts, every study, the audit log and erasures."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import UserAccount
from app.models.enums import AuditActorType
from app.schemas.admin import (
    AccountCreate,
    AccountCreatedOut,
    AccountLinkOut,
    AccountOut,
    AccountUpdate,
    AdminPoolConcelhoOut,
    AdminPoolFieldsOut,
    AdminPoolInvitationResultsOut,
    AdminPoolOverviewOut,
    AdminStudyOut,
    AuditEventOut,
    AuditLogPage,
    CompletedErasureOut,
    ErasureConfirmRequest,
    ErasureListOut,
    ErasureResultOut,
    ScheduledErasureOut,
    StudyResearcherOut,
)
from app.security import totp
from app.security.audit import record
from app.security.deps import require_admin
from app.services import admin as service
from app.services import erasure as erasure_service
from app.services import erasure_requests as erasure_requests_service
from app.services import pool as pool_service

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[Session, Depends(get_session)]
AdminUser = Annotated[UserAccount, Depends(require_admin)]


def _account_out(summary: service.AccountSummary) -> AccountOut:
    user = summary.user
    return AccountOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        state=service.account_state(user),
        locked=service.is_locked(user),
        locked_until=user.locked_until,
        studies=summary.studies,
        last_session_at=summary.last_session_at,
        totp_enrolled=user.totp_confirmed_at is not None,
        created_at=user.created_at,
    )


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(session: SessionDep, _admin: AdminUser) -> list[AccountOut]:
    """FR-41: every researcher and administrator account."""
    return [_account_out(summary) for summary in service.list_accounts(session)]


@router.post("/accounts", response_model=AccountCreatedOut, status_code=201)
def create_account(
    payload: AccountCreate, session: SessionDep, admin: AdminUser
) -> AccountCreatedOut:
    """FR-41: create an account and mail it a link to choose its own password."""
    user, mail_sent = service.create_account(
        session, admin, payload.email, payload.role, payload.name
    )
    summary = service.account_summary(session, user)
    return AccountCreatedOut(**_account_out(summary).model_dump(), mail_sent=mail_sent)


@router.patch("/accounts/{user_id}", response_model=AccountOut)
def update_account(
    user_id: uuid.UUID,
    payload: AccountUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> AccountOut:
    """FR-41: change an account's role, its name, or both."""
    user = service.update_account(
        session,
        admin,
        user_id,
        role=payload.role,
        name=payload.name,
        name_set="name" in payload.model_fields_set,
    )
    return _account_out(service.account_summary(session, user))


@router.post("/accounts/{user_id}/lock", response_model=AccountOut)
def lock_account(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> AccountOut:
    """FR-41 and UC14: deactivate an account and revoke its refresh tokens."""
    user = service.lock_account(session, admin, user_id)
    return _account_out(service.account_summary(session, user))


@router.post("/accounts/{user_id}/unlock", response_model=AccountOut)
def unlock_account(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> AccountOut:
    """FR-41: reactivate an account."""
    user = service.unlock_account(session, admin, user_id)
    return _account_out(service.account_summary(session, user))


@router.post("/accounts/{user_id}/send-link", response_model=AccountLinkOut)
def send_account_link(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> AccountLinkOut:
    """FR-41: send a fresh single-use link for the person to choose a password."""
    return AccountLinkOut(mail_sent=service.send_account_link(session, admin, user_id))


@router.get("/studies", response_model=list[AdminStudyOut])
def list_all_studies(session: SessionDep, _admin: AdminUser) -> list[AdminStudyOut]:
    """FR-42 and UC15: every study with its team, owner and counts."""
    return [
        AdminStudyOut(
            id=overview.study.id,
            title=overview.study.title,
            status=overview.study.status,
            schedule_style=overview.study.schedule_style,
            starts_on=overview.study.starts_on,
            ends_on=overview.study.ends_on,
            owner_email=overview.owner_email,
            team=[
                StudyResearcherOut(
                    user_id=member.user_id,
                    email=account.email,
                    name=account.name,
                    role=member.role,
                )
                for member, account in overview.team
            ],
            participants=overview.participants,
            active_participants=overview.active_participants,
            entries=overview.entries,
            adherence_percentage=overview.adherence_percentage,
            adherence_period=overview.adherence_period,
        )
        for overview in service.study_overview(session)
    ]


@router.get("/audit-log", response_model=AuditLogPage)
def list_audit_log(
    session: SessionDep,
    _admin: AdminUser,
    actor_type: AuditActorType | None = None,
    action: str | None = None,
    q: str | None = None,
    study_id: uuid.UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    cursor: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditLogPage:
    """FR-43 and UC16: read-only audit log with filters and cursor pagination."""
    page = service.list_audit(
        session,
        actor_type=actor_type,
        action=action,
        q=q,
        study_id=study_id,
        since=since,
        until=until,
        cursor=cursor,
        limit=limit,
    )
    names = service.actor_names(session, page.events)
    titles = service.actor_study_titles(session, page.events)
    return AuditLogPage(
        items=[
            AuditEventOut(
                id=event.id,
                actor_type=event.actor_type,
                actor_id=event.actor_id,
                actor_name=(
                    names.get((event.actor_type, event.actor_id))
                    if event.actor_id is not None
                    else None
                ),
                actor_study_title=(
                    titles.get(event.actor_id) if event.actor_id is not None else None
                ),
                action=event.action,
                target=event.target,
                details=event.details,
                origin_client=event.origin_client,
                origin_ip=event.origin_ip,
                origin_browser=event.origin_browser,
                at=event.at,
            )
            for event in page.events
        ],
        next_cursor=page.next_cursor,
        total=page.total,
        page_count=page.page_count,
    )


@router.get("/pool/overview", response_model=AdminPoolOverviewOut)
def pool_overview(session: SessionDep, _admin: AdminUser) -> AdminPoolOverviewOut:
    """Aggregates for the administrator pool screen; never a member profile."""
    overview = pool_service.admin_overview(session)
    return AdminPoolOverviewOut(
        members_total=overview["members_total"],
        members_paused=overview["members_paused"],
        top_concelhos=overview["top_concelhos"],
        invitations_sent=overview["invitations_sent"],
        invitations_accepted=overview["invitations_accepted"],
        concelhos=[
            AdminPoolConcelhoOut(**row)
            for row in overview["concelhos"]  # type: ignore[arg-type]
        ],
        fields=AdminPoolFieldsOut(**overview["fields"]),  # type: ignore[arg-type]
        invitation_results=[
            AdminPoolInvitationResultsOut(**row)
            for row in overview["invitation_results"]  # type: ignore[arg-type]
        ],
    )


@router.get("/erasures", response_model=ErasureListOut)
def list_erasures(
    session: SessionDep,
    _admin: AdminUser,
    cursor: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> ErasureListOut:
    """FR-44, FR-85: erasures scheduled from the app (read only) and those already run."""
    listing = service.list_erasures(session, cursor=cursor, limit=limit)
    study_ids = {participant.study_id for participant in listing.scheduled}
    study_ids.update(item.study_id for item in listing.completed if item.study_id is not None)
    titles = service.study_titles(session, study_ids)
    names = service.user_names(
        session,
        {
            item.actor_id
            for item in listing.completed
            if item.actor_id is not None and item.actor_type == AuditActorType.USER
        },
    )

    completed = [
        CompletedErasureOut(
            participant_id=item.participant_id,
            alias=item.alias,
            study_id=item.study_id,
            study_title=titles.get(item.study_id) if item.study_id is not None else None,
            actor_type=item.actor_type,
            actor_id=item.actor_id,
            actor_name=names.get(item.actor_id) if item.actor_id is not None else None,
            at=item.at,
            entries=item.entries,
            files=item.files,
        )
        for item in listing.completed
    ]

    return ErasureListOut(
        scheduled=[
            ScheduledErasureOut(
                participant_id=participant.id,
                study_id=participant.study_id,
                study_title=titles.get(participant.study_id),
                alias=participant.alias,
                requested_at=participant.erasure_requested_at,
                due_at=participant.erasure_due_at,
            )
            for participant in listing.scheduled
        ],
        completed=completed,
        next_cursor=listing.next_cursor,
    )


TOTP_NOT_ENROLLED = "The administrator must enrol a TOTP authenticator first."
TOTP_REQUIRED = "A TOTP code is required."
TOTP_INVALID = "The TOTP code is not valid."


def _audit_erasure_failure(
    session: Session, admin: UserAccount, participant_id: uuid.UUID, reason: str
) -> None:
    """A refused erasure leaves a row, like a failed sign-in, and nothing else."""
    record(
        session,
        admin,
        "erasure_failed",
        target=str(participant_id),
        details={"reason": reason},
    )
    session.commit()


def _require_totp(
    session: Session, admin: UserAccount, participant_id: uuid.UUID, code: str | None
) -> None:
    if admin.totp_secret is None or admin.totp_confirmed_at is None:
        _audit_erasure_failure(session, admin, participant_id, "totp_enrolment_required")
        raise ApiError(403, "totp_enrolment_required", TOTP_NOT_ENROLLED)
    if not code or not code.strip():
        _audit_erasure_failure(session, admin, participant_id, "totp_missing")
        raise ApiError(401, "totp_required", TOTP_REQUIRED)
    if not totp.verify_code(admin.totp_secret, code):
        _audit_erasure_failure(session, admin, participant_id, "bad_totp")
        raise ApiError(401, "invalid_totp", TOTP_INVALID)


@router.post("/participants/{participant_id}/erasure", response_model=ErasureResultOut)
def erase_participant(
    participant_id: uuid.UUID,
    session: SessionDep,
    admin: AdminUser,
    payload: ErasureConfirmRequest | None = None,
) -> ErasureResultOut:
    """FR-44 and UC17: erase one participant from the live system, immediately.

    The administrator confirms with a fresh TOTP code, verified against the secret of the signed-in
    account with the same helper as the sign-in. A wrong or missing code erases nothing and leaves
    an ``erasure_failed`` row in the audit log.
    """
    _require_totp(session, admin, participant_id, payload.totp_code if payload else None)
    # Read the team's request before the erasure clears the participant link on it.
    request = erasure_requests_service.pending_for_participant(session, participant_id)
    result = erasure_service.erase_participant_now(session, admin, participant_id)
    if request is not None:
        erasure_requests_service.mark_done(
            session,
            request.id,
            admin,
            participant_id=participant_id,
            entries=result.entries,
            files=result.files,
        )
    return ErasureResultOut(
        participant_id=result.participant_id,
        entries_deleted=result.entries,
        files_deleted=result.files,
    )
