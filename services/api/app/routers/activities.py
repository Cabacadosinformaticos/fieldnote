"""Activities and their response scales, nested under a study."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.enums import StudyRole
from app.schemas.activities import ActivityCreate, ActivityOut, ActivityUpdate
from app.security.deps import StudyAccess, require_study_role
from app.services import activities

router = APIRouter(tags=["activities"])

any_member = require_study_role()

SessionDep = Annotated[Session, Depends(get_session)]
AnyMember = Annotated[StudyAccess, Depends(any_member)]
# Designing the study (activities, questions) is for the principal investigator and the
# co-investigator; members read and tag.
Designer = Annotated[
    StudyAccess,
    Depends(require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR, StudyRole.CO_INVESTIGATOR)),
]


@router.get("/studies/{study_id}/activities", response_model=list[ActivityOut])
def list_activities(
    study_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> list[ActivityOut]:
    return activities.list_activities(session, study_id)


@router.post("/studies/{study_id}/activities", response_model=ActivityOut, status_code=201)
def create_activity(
    study_id: uuid.UUID,
    payload: ActivityCreate,
    access: Designer,
    session: SessionDep,
) -> ActivityOut:
    return activities.create_activity(session, access.user, study_id, payload)


@router.get("/studies/{study_id}/activities/{activity_id}", response_model=ActivityOut)
def get_activity(
    study_id: uuid.UUID,
    activity_id: uuid.UUID,
    access: AnyMember,
    session: SessionDep,
) -> ActivityOut:
    return activities.get_activity(session, study_id, activity_id)


@router.patch("/studies/{study_id}/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    study_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
    access: Designer,
    session: SessionDep,
) -> ActivityOut:
    return activities.update_activity(session, access.user, study_id, activity_id, payload)


@router.delete("/studies/{study_id}/activities/{activity_id}", status_code=204)
def delete_activity(
    study_id: uuid.UUID,
    activity_id: uuid.UUID,
    access: Designer,
    session: SessionDep,
) -> None:
    activities.delete_activity(session, access.user, study_id, activity_id)
