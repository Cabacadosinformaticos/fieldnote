"""Administrator screens: researcher accounts, every study, the audit log and erasures."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Participant, UserAccount
from app.models.enums import AuditActorType, ParticipantStatus
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
    ErasureListOut,
    ErasureResultOut,
    ScheduledErasureOut,
    StudyResearcherOut,
)
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


def _uuid_or_none(value: object) -> uuid.UUID | None:
    if not isinstance(value, str):
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _int_or_zero(value: object) -> int:
    return value if isinstance(value, int) else 0


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
    for row in listing.completed:
        details = row.details or {}
        study_id = _uuid_or_none(details.get("study_id"))
        if study_id is not None:
            study_ids.add(study_id)
    titles = service.study_titles(session, study_ids)

    completed: list[CompletedErasureOut] = []
    for row in listing.completed:
        participant_id = _uuid_or_none(row.target)
        if participant_id is None:
            continue
        details = row.details or {}
        study_id = _uuid_or_none(details.get("study_id"))
        completed.append(
            CompletedErasureOut(
                participant_id=participant_id,
                study_id=study_id,
                study_title=titles.get(study_id) if study_id is not None else None,
                actor_type=row.actor_type,
                actor_id=row.actor_id,
                at=row.at,
                entries=_int_or_zero(details.get("entries")),
                files=_int_or_zero(details.get("files")),
            )
        )

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


@router.post("/participants/{participant_id}/erasure", response_model=ErasureResultOut)
def erase_participant(
    participant_id: uuid.UUID, session: SessionDep, admin: AdminUser
) -> ErasureResultOut:
    """FR-44 and UC17: erase one participant from the live system, immediately."""
    participant = session.get(Participant, participant_id)
    if participant is not None and participant.status != ParticipantStatus.ERASURE_SCHEDULED:
        # Close the team's request first: the participant row cascades the request away.
        erasure_requests_service.mark_done(session, participant_id, admin)
    result = erasure_service.erase_participant_now(session, admin, participant_id)
    return ErasureResultOut(
        participant_id=result.participant_id,
        entries_deleted=result.entries,
        files_deleted=result.files,
    )
