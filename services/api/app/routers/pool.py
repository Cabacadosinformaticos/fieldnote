"""The volunteer pool and recruiting from it.

A pool member authenticates with ``Authorization: Pool <credential>``. Researchers set criteria
and receive only a count; no route returns a pool profile to them. Accepting an invitation creates
a new participant row under a new alias and a new device token, as a code would.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import PoolInvitation, PoolMember, Study
from app.models.enums import StudyStatus
from app.schemas.participation import StudyCardOut, StudySummaryOut
from app.schemas.pool import (
    PoolCountOut,
    PoolCriteria,
    PoolInvitationAcceptOut,
    PoolInvitationAcceptRequest,
    PoolInvitationOut,
    PoolJoinedParticipantOut,
    PoolJoinOut,
    PoolJoinRequest,
    PoolMemberOut,
    PoolProfileUpdate,
    PoolSendOut,
)
from app.security.deps import StudyAccess, require_study_role
from app.services import participation as participation_service
from app.services import pool as service

router = APIRouter()
member_router = APIRouter(prefix="/pool", tags=["pool"])
study_router = APIRouter(prefix="/studies/{study_id}/pool", tags=["pool"])

SessionDep = Annotated[Session, Depends(get_session)]
_member_access = require_study_role()
MemberAccess = Annotated[StudyAccess, Depends(_member_access)]


def current_pool_member(
    session: SessionDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> PoolMember:
    scheme, _, raw = (authorization or "").partition(" ")
    credential = raw.strip()
    if scheme.lower() != "pool" or not credential:
        raise ApiError(401, "not_authenticated", "A pool credential is required.")
    member = service.member_for_credential(session, credential)
    if member is None:
        raise ApiError(401, "invalid_pool_credential", "The pool credential is invalid.")
    return member


MemberDep = Annotated[PoolMember, Depends(current_pool_member)]


def _member_out(member: PoolMember) -> PoolMemberOut:
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


def _invitation_out(
    session: Session, invitation: PoolInvitation, member: PoolMember
) -> PoolInvitationOut:
    study = session.get(Study, invitation.study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    card = participation_service.study_card(session, study)
    return PoolInvitationOut(
        id=invitation.id,
        status=invitation.status,
        reason="pool_member",
        concelho=member.concelho,
        sent_at=invitation.sent_at,
        expires_at=invitation.expires_at,
        responded_at=invitation.responded_at,
        study=StudyCardOut(**card),
    )


def _study_summary(study: Study) -> StudySummaryOut:
    return StudySummaryOut(
        id=study.id,
        title=study.title,
        status=study.status,
        starts_on=study.starts_on,
        ends_on=study.ends_on,
        timezone=study.timezone,
    )


@member_router.post("/members", status_code=201, response_model=PoolJoinOut)
def join_pool(payload: PoolJoinRequest, session: SessionDep) -> PoolJoinOut:
    member, credential = service.join_pool(session, payload)
    return PoolJoinOut(**_member_out(member).model_dump(), credential=credential)


@member_router.get("/me", response_model=PoolMemberOut)
def get_my_profile(member: MemberDep) -> PoolMemberOut:
    return _member_out(member)


@member_router.patch("/me", response_model=PoolMemberOut)
def update_my_profile(
    payload: PoolProfileUpdate,
    member: MemberDep,
    session: SessionDep,
) -> PoolMemberOut:
    service.update_profile(session, member, payload.model_dump(exclude_unset=True))
    return _member_out(member)


@member_router.delete("/me", status_code=204)
def leave_the_pool(member: MemberDep, session: SessionDep) -> None:
    service.leave_pool(session, member)


@member_router.get("/invitations", response_model=list[PoolInvitationOut])
def list_my_invitations(member: MemberDep, session: SessionDep) -> list[PoolInvitationOut]:
    return [
        _invitation_out(session, invitation, member)
        for invitation in service.list_invitations(session, member)
    ]


@member_router.get("/invitations/{invitation_id}", response_model=PoolInvitationOut)
def get_my_invitation(
    invitation_id: uuid.UUID,
    member: MemberDep,
    session: SessionDep,
) -> PoolInvitationOut:
    invitation = service.get_invitation(session, member, invitation_id)
    return _invitation_out(session, invitation, member)


@member_router.post("/invitations/{invitation_id}/accept", response_model=PoolInvitationAcceptOut)
def accept_my_invitation(
    invitation_id: uuid.UUID,
    payload: PoolInvitationAcceptRequest,
    member: MemberDep,
    session: SessionDep,
) -> PoolInvitationAcceptOut:
    acceptance = service.accept_invitation(session, member, invitation_id, payload)
    participant = acceptance.participant
    study = session.get(Study, participant.study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    return PoolInvitationAcceptOut(
        outcome="joined",
        device_token=acceptance.device_token,
        participant=PoolJoinedParticipantOut(
            id=participant.id,
            study=_study_summary(study),
            alias=participant.alias,
            status=participant.status,
            has_consent=participation_service.has_consent(session, participant),
        ),
    )


@member_router.post("/invitations/{invitation_id}/decline", response_model=PoolInvitationOut)
def decline_my_invitation(
    invitation_id: uuid.UUID,
    member: MemberDep,
    session: SessionDep,
) -> PoolInvitationOut:
    invitation = service.decline_invitation(session, member, invitation_id)
    return _invitation_out(session, invitation, member)


def _recruitable_study(session: Session, study_id: uuid.UUID) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    if study.status == StudyStatus.CLOSED:
        raise ApiError(409, "study_closed", "A closed study cannot recruit from the pool.")
    return study


@study_router.post("/count", response_model=PoolCountOut)
def count_pool_members(
    study_id: uuid.UUID,
    payload: PoolCriteria,
    access: MemberAccess,
    session: SessionDep,
) -> PoolCountOut:
    _recruitable_study(session, study_id)
    return PoolCountOut(count=service.count_matching(session, payload))


@study_router.post("/invitations", status_code=201, response_model=PoolSendOut)
def send_pool_invitations(
    study_id: uuid.UUID,
    payload: PoolCriteria,
    access: MemberAccess,
    session: SessionDep,
) -> PoolSendOut:
    study = _recruitable_study(session, study_id)
    sent, expires_at = service.send_invitations(session, access.user, study, payload)
    return PoolSendOut(sent=sent, expires_at=expires_at)


router.include_router(member_router)
router.include_router(study_router)
