"""Studies, their team, study questions and tags."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import UserAccount
from app.models.enums import StudyRole
from app.schemas.studies import (
    StudyCreate,
    StudyMemberCreate,
    StudyMemberOut,
    StudyMemberUpdate,
    StudyOut,
    StudyQuestionCreate,
    StudyQuestionOrder,
    StudyQuestionOut,
    StudyQuestionUpdate,
    StudyUpdate,
    TagCreate,
    TagOut,
)
from app.security.deps import StudyAccess, current_user, require_study_role
from app.services import studies

router = APIRouter(prefix="/studies", tags=["studies"])

any_member = require_study_role()
principal_only = require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR)

SessionDep = Annotated[Session, Depends(get_session)]
AnyMember = Annotated[StudyAccess, Depends(any_member)]
PrincipalOnly = Annotated[StudyAccess, Depends(principal_only)]
# Designing the study (activities, questions) is for the principal investigator and the
# co-investigator; members read and tag.
Designer = Annotated[
    StudyAccess,
    Depends(require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR, StudyRole.CO_INVESTIGATOR)),
]


@router.post("", response_model=StudyOut, status_code=201)
def create_study(
    payload: StudyCreate,
    user: Annotated[UserAccount, Depends(current_user)],
    session: SessionDep,
) -> StudyOut:
    return studies.create_study(session, user, payload)


@router.get("", response_model=list[StudyOut])
def list_my_studies(
    user: Annotated[UserAccount, Depends(current_user)],
    session: SessionDep,
) -> list[StudyOut]:
    return studies.list_studies(session, user)


@router.get("/{study_id}", response_model=StudyOut)
def get_study(
    study_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> StudyOut:
    return studies.get_study(session, study_id)


@router.patch("/{study_id}", response_model=StudyOut)
def update_study(
    study_id: uuid.UUID,
    payload: StudyUpdate,
    access: PrincipalOnly,
    session: SessionDep,
) -> StudyOut:
    return studies.update_study(session, access.user, study_id, payload)


@router.post("/{study_id}/start", response_model=StudyOut)
def start_study(
    study_id: uuid.UUID,
    access: PrincipalOnly,
    session: SessionDep,
) -> StudyOut:
    return studies.start_study(session, access.user, study_id)


@router.post("/{study_id}/close", response_model=StudyOut)
def close_study(
    study_id: uuid.UUID,
    access: PrincipalOnly,
    session: SessionDep,
) -> StudyOut:
    return studies.close_study(session, access.user, study_id)


@router.get("/{study_id}/members", response_model=list[StudyMemberOut])
def list_members(
    study_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> list[StudyMemberOut]:
    return [
        StudyMemberOut(user_id=member.user_id, email=account.email, role=member.role)
        for member, account in studies.list_members(session, study_id)
    ]


@router.post("/{study_id}/members", response_model=StudyMemberOut, status_code=201)
def add_member(
    study_id: uuid.UUID,
    payload: StudyMemberCreate,
    access: PrincipalOnly,
    session: SessionDep,
) -> StudyMemberOut:
    member, account = studies.add_member(
        session, access.user, study_id, payload.email, payload.role
    )
    return StudyMemberOut(user_id=member.user_id, email=account.email, role=member.role)


@router.patch("/{study_id}/members/{user_id}", response_model=StudyMemberOut)
def change_member_role(
    study_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: StudyMemberUpdate,
    access: PrincipalOnly,
    session: SessionDep,
) -> StudyMemberOut:
    member = studies.change_member_role(session, access.user, study_id, user_id, payload.role)
    account = session.get(UserAccount, user_id)
    return StudyMemberOut(user_id=member.user_id, email=account.email, role=member.role)


@router.delete("/{study_id}/members/{user_id}", status_code=204)
def remove_member(
    study_id: uuid.UUID,
    user_id: uuid.UUID,
    access: PrincipalOnly,
    session: SessionDep,
) -> None:
    studies.remove_member(session, access.user, study_id, user_id)


@router.get("/{study_id}/questions", response_model=list[StudyQuestionOut])
def list_questions(
    study_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> list[StudyQuestionOut]:
    return studies.list_questions(session, study_id)


@router.post("/{study_id}/questions", response_model=StudyQuestionOut, status_code=201)
def create_question(
    study_id: uuid.UUID,
    payload: StudyQuestionCreate,
    access: Designer,
    session: SessionDep,
) -> StudyQuestionOut:
    return studies.create_question(session, access.user, study_id, payload)


@router.put("/{study_id}/questions/order", response_model=list[StudyQuestionOut])
def reorder_questions(
    study_id: uuid.UUID,
    payload: StudyQuestionOrder,
    access: Designer,
    session: SessionDep,
) -> list[StudyQuestionOut]:
    return studies.reorder_questions(session, access.user, study_id, payload.question_ids)


@router.patch("/{study_id}/questions/{question_id}", response_model=StudyQuestionOut)
def update_question(
    study_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: StudyQuestionUpdate,
    access: Designer,
    session: SessionDep,
) -> StudyQuestionOut:
    return studies.update_question(session, access.user, study_id, question_id, payload)


@router.delete("/{study_id}/questions/{question_id}", status_code=204)
def delete_question(
    study_id: uuid.UUID,
    question_id: uuid.UUID,
    access: Designer,
    session: SessionDep,
) -> None:
    studies.delete_question(session, access.user, study_id, question_id)


@router.get("/{study_id}/tags", response_model=list[TagOut])
def list_tags(
    study_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> list[TagOut]:
    return studies.list_tags(session, study_id)


@router.post("/{study_id}/tags", response_model=TagOut, status_code=201)
def create_tag(
    study_id: uuid.UUID,
    payload: TagCreate,
    access: AnyMember,
    session: SessionDep,
) -> TagOut:
    return studies.create_tag(session, access.user, study_id, payload.name)


@router.delete("/{study_id}/tags/{tag_id}", status_code=204)
def delete_tag(
    study_id: uuid.UUID,
    tag_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> None:
    studies.delete_tag(session, access.user, study_id, tag_id)
