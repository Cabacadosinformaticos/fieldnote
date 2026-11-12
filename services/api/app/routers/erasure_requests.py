"""Erasure requests passed by a study team to the administrator (UC17)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import ErasureRequest, Participant, Study, UserAccount
from app.models.enums import StudyRole
from app.schemas.erasure_requests import (
    ErasureRequestCountsOut,
    ErasureRequestCreate,
    ErasureRequestSummaryOut,
    PendingErasureRequestOut,
)
from app.security.deps import StudyAccess, require_admin, require_study_role
from app.services import erasure_requests as service

router = APIRouter(tags=["erasure-requests"])

_member = require_study_role()
_owner = require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR)

MemberAccess = Annotated[StudyAccess, Depends(_member)]
OwnerAccess = Annotated[StudyAccess, Depends(_owner)]
AdminUser = Annotated[UserAccount, Depends(require_admin)]


def _study(session: Session, study_id: uuid.UUID) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    return study


def _participant(session: Session, study_id: uuid.UUID, participant_id: uuid.UUID) -> Participant:
    participant = session.get(Participant, participant_id)
    if participant is None or participant.study_id != study_id:
        raise ApiError(
            404, "participant_not_found", "The participant does not exist in this study."
        )
    return participant


def _summary_out(session: Session, request: ErasureRequest) -> ErasureRequestSummaryOut:
    name = None
    if request.requested_by is not None:
        requester = session.get(UserAccount, request.requested_by)
        if requester is not None:
            name = requester.name or requester.email
    return ErasureRequestSummaryOut(
        id=request.id,
        status=request.status,
        participant_id=request.participant_id,
        study_id=request.study_id,
        requested_by=request.requested_by,
        requested_by_name=name,
        received_at=request.received_at,
        created_at=request.created_at,
    )


@router.get(
    "/studies/{study_id}/participants/{participant_id}/erasure-request",
    response_model=ErasureRequestSummaryOut | None,
)
def get_erasure_request(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: MemberAccess,
) -> ErasureRequestSummaryOut | None:
    """The pending request of one participant, if the team already passed it on."""
    _study(session, study_id)
    _participant(session, study_id, participant_id)
    request = service.pending_request(session, study_id, participant_id)
    return None if request is None else _summary_out(session, request)


@router.post(
    "/studies/{study_id}/participants/{participant_id}/erasure-request",
    response_model=ErasureRequestSummaryOut,
    status_code=201,
)
def create_erasure_request(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: ErasureRequestCreate,
    session: Annotated[Session, Depends(get_session)],
    access: OwnerAccess,
) -> ErasureRequestSummaryOut:
    """The study owner records that the team decided to grant an outside-the-app request."""
    _study(session, study_id)
    _participant(session, study_id, participant_id)
    request = service.create_request(
        session, study_id, participant_id, access.user, payload.received_at
    )
    return _summary_out(session, request)


@router.delete(
    "/studies/{study_id}/participants/{participant_id}/erasure-request",
    status_code=204,
)
def cancel_erasure_request(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> None:
    """The team withdraws a request it had passed on before the administrator acts."""
    _study(session, study_id)
    _participant(session, study_id, participant_id)
    service.cancel_request(session, study_id, participant_id, access.user)


@router.get("/admin/erasure-requests", response_model=list[PendingErasureRequestOut])
def list_pending_erasure_requests(
    session: Annotated[Session, Depends(get_session)],
    _admin: AdminUser,
) -> list[PendingErasureRequestOut]:
    """UC17: outside-the-app requests waiting for the administrator, with their counts."""
    return [
        PendingErasureRequestOut(
            id=item.request.id,
            status=item.request.status,
            participant_id=item.participant.id,
            study_id=item.study.id,
            requested_by=item.request.requested_by,
            requested_by_name=item.requested_by_name,
            received_at=item.request.received_at,
            created_at=item.request.created_at,
            alias=item.participant.alias,
            study_title=item.study.title,
            requested_by_role=item.requested_by_role,
            counts=ErasureRequestCountsOut(
                entries=item.counts.entries,
                files=item.counts.files,
                entry_types=item.counts.entry_types,
                has_identity=item.counts.has_identity,
                study_participants=item.counts.study_participants,
                study_entries=item.counts.study_entries,
            ),
        )
        for item in service.list_pending(session)
    ]
