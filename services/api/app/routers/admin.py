"""Administrator screens: researcher accounts, every study, the audit log and erasures."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import UserAccount
from app.models.enums import AuditActorType
from app.schemas.admin import (
    AccountCreate,
    AccountCreatedOut,
    AccountOut,
    AccountRoleUpdate,
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
from app.services import pool as pool_service

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[Session, Depends(get_session)]
AdminUser = Annotated[UserAccount, Depends(require_admin)]


def _account_out(user: UserAccount) -> AccountOut:
    return AccountOut(
        id=user.id,
        email=user.email,
        role=user.role,
        locked=service.is_locked(user),
        locked_until=user.locked_until,
        totp_enrolled=user.totp_secret is not None,
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
    return [_account_out(user) for user in service.list_accounts(session)]


@router.post("/accounts", response_model=AccountCreatedOut, status_code=201)
def create_account(
    payload: AccountCreate, session: SessionDep, admin: AdminUser
) -> AccountCreatedOut:
    """FR-41: create an account and return its temporary password once."""
    user, temporary_password = service.create_account(session, admin, payload.email, payload.role)
    return AccountCreatedOut(
        **_account_out(user).model_dump(), temporary_password=temporary_password
    )


@router.patch("/accounts/{user_id}", response_model=AccountOut)
def change_account_role(
    user_id: uuid.UUID,
    payload: AccountRoleUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> AccountOut:
    """FR-41: change an account between researcher and administrator."""
    return _account_out(service.change_role(session, admin, user_id, payload.role))


@router.post("/accounts/{user_id}/lock", response_model=AccountOut)
def lock_account(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> AccountOut:
    """FR-41 and UC14: deactivate an account and revoke its refresh tokens."""
    return _account_out(service.lock_account(session, admin, user_id))


@router.post("/accounts/{user_id}/unlock", response_model=AccountOut)
def unlock_account(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> AccountOut:
    """FR-41: reactivate an account."""
    return _account_out(service.unlock_account(session, admin, user_id))


@router.delete("/accounts/{user_id}", status_code=204)
def delete_account(user_id: uuid.UUID, session: SessionDep, admin: AdminUser) -> None:
    """FR-41: remove an account."""
    service.delete_account(session, admin, user_id)


@router.get("/studies", response_model=list[AdminStudyOut])
def list_all_studies(session: SessionDep, _admin: AdminUser) -> list[AdminStudyOut]:
    """FR-42 and UC15: every study with its team, owner and counts."""
    return [
        AdminStudyOut(
            id=overview.study.id,
            title=overview.study.title,
            status=overview.study.status,
            starts_on=overview.study.starts_on,
            ends_on=overview.study.ends_on,
            owner_email=overview.owner_email,
            team=[
                StudyResearcherOut(
                    user_id=member.user_id,
                    email=account.email,
                    role=member.role,
                )
                for member, account in overview.team
            ],
            participants=overview.participants,
            entries=overview.entries,
        )
        for overview in service.study_overview(session)
    ]


@router.get("/audit-log", response_model=AuditLogPage)
def list_audit_log(
    session: SessionDep,
    _admin: AdminUser,
    actor_type: AuditActorType | None = None,
    action: str | None = None,
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
        study_id=study_id,
        since=since,
        until=until,
        cursor=cursor,
        limit=limit,
    )
    return AuditLogPage(
        items=[
            AuditEventOut(
                id=event.id,
                actor_type=event.actor_type,
                actor_id=event.actor_id,
                action=event.action,
                target=event.target,
                details=event.details,
                at=event.at,
            )
            for event in page.events
        ],
        next_cursor=page.next_cursor,
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
    result = erasure_service.erase_participant_now(session, admin, participant_id)
    return ErasureResultOut(
        participant_id=result.participant_id,
        entries_deleted=result.entries,
        files_deleted=result.files,
    )
