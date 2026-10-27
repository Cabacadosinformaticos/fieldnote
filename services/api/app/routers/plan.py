"""The plan of one study day: prompts, their state and availability."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.plan import StudyPlanOut
from app.security.deps import StudyAccess, require_study_role
from app.services import plan

router = APIRouter(prefix="/studies/{study_id}", tags=["plan"])

study_member = require_study_role()


@router.get("/plan", response_model=StudyPlanOut)
def get_study_plan(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
    plan_date: Annotated[date, Query(alias="date")],
) -> dict[str, object]:
    return plan.study_plan(session, study_id, plan_date)
