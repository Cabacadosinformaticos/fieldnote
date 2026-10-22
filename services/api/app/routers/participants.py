"""Participant list, personal codes, removal, identity reads and entry approval."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import Participant, Study
from app.models.enums import ParticipantStatus, StudyRole
from app.schemas.participants import (
    ApprovalOut,
    ParticipantAddedOut,
    ParticipantCreate,
    ParticipantIdentityOut,
    ParticipantOut,
    PersonalInviteCodeOut,
)
from app.security.deps import StudyAccess, require_study_role
from app.services import participants as service

router = APIRouter(prefix="/studies/{study_id}", tags=["participants"])

_member = require_study_role()
_owner_or_admin = require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR)

MemberAccess = Annotated[StudyAccess, Depends(_member)]
OwnerAccess = Annotated[StudyAccess, Depends(_owner_or_admin)]


def _study(session: Session, study_id: uuid.UUID) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    return study


def _participant(session: Session, study_id: uuid.UUID, participant_id: uuid.UUID) -> Participant:
    return service.get_participant(session, study_id, participant_id)


def _out(
    session: Session, participant: Participant, routes: dict[uuid.UUID, str | None] | None = None
) -> ParticipantOut:
    if routes is None:
        routes = service.entry_routes(session, [participant])
    hidden = participant.status == ParticipantStatus.ERASURE_SCHEDULED
    return ParticipantOut(
        id=participant.id,
        alias=participant.alias,
        status=participant.status,
        entered_at=None if hidden else participant.entered_at,
        erasure_due_at=participant.erasure_due_at,
        entry_route=None if hidden else routes[participant.id],
    )


@router.post("/participants", status_code=201, response_model=ParticipantAddedOut)
def add_participant(
    study_id: uuid.UUID,
    payload: ParticipantCreate,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> ParticipantAddedOut:
    _study(session, study_id)
    participant, code, raw = service.add_participant(
        session,
        study_id,
        access.user,
        alias=payload.alias,
        name=payload.name,
        email=payload.email,
    )
    out = _out(session, participant)
    return ParticipantAddedOut(
        **out.model_dump(),
        invite_code=PersonalInviteCodeOut(code=raw, expires_at=code.expires_at),
    )


@router.get("/participants", response_model=list[ParticipantOut])
def list_participants(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: MemberAccess,
) -> list[ParticipantOut]:
    _study(session, study_id)
    participants = service.list_participants(session, study_id)
    routes = service.entry_routes(session, participants)
    return [_out(session, participant, routes) for participant in participants]


@router.get("/participants/{participant_id}", response_model=ParticipantOut)
def get_participant(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: MemberAccess,
) -> ParticipantOut:
    _study(session, study_id)
    return _out(session, _participant(session, study_id, participant_id))


@router.post(
    "/participants/{participant_id}/invite-code",
    status_code=201,
    response_model=PersonalInviteCodeOut,
)
def issue_personal_code(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> PersonalInviteCodeOut:
    _study(session, study_id)
    participant = _participant(session, study_id, participant_id)
    code, raw = service.issue_personal_code(session, participant, access.user)
    session.commit()
    return PersonalInviteCodeOut(code=raw, expires_at=code.expires_at)


@router.post("/participants/{participant_id}/remove", status_code=204)
def remove_participant(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> None:
    _study(session, study_id)
    participant = _participant(session, study_id, participant_id)
    service.remove_participant(session, participant, access.user)


@router.get("/participants/{participant_id}/identity", response_model=ParticipantIdentityOut)
def read_participant_identity(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: OwnerAccess,
) -> ParticipantIdentityOut:
    _study(session, study_id)
    participant = _participant(session, study_id, participant_id)
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(
            404, "participant_not_found", "The participant is hidden while an erasure is scheduled."
        )
    identity = service.read_identity(session, participant, access.user)
    return ParticipantIdentityOut(
        name=identity.name if identity is not None else None,
        email=identity.email if identity is not None else None,
    )


@router.get("/approvals", response_model=list[ApprovalOut])
def list_waiting_entries(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: MemberAccess,
) -> list[ApprovalOut]:
    _study(session, study_id)
    return [
        ApprovalOut(
            order=order,
            participant_id=participant.id,
            entered_at=participant.entered_at,
            invite_code_id=code.id if code is not None else None,
            code=code.code_value if code is not None else None,
        )
        for order, participant, code in service.list_waiting(session, study_id)
    ]


@router.post("/approvals/{participant_id}/approve", response_model=ParticipantOut)
def approve_entry(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> ParticipantOut:
    _study(session, study_id)
    participant = _participant(session, study_id, participant_id)
    service.approve_participant(session, participant, access.user)
    return _out(session, participant)


@router.post("/approvals/{participant_id}/decline", response_model=ParticipantOut)
def decline_entry(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> ParticipantOut:
    _study(session, study_id)
    participant = _participant(session, study_id, participant_id)
    service.decline_participant(session, participant, access.user)
    return _out(session, participant)
