"""Study overview: participant states, entry counts, adherence and alerts."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.overview import StudyOverviewOut
from app.security.deps import StudyAccess, require_study_role
from app.services import overview

router = APIRouter(prefix="/studies/{study_id}", tags=["overview"])

study_member = require_study_role()


@router.get("/overview", response_model=StudyOverviewOut)
def get_study_overview(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return overview.study_overview(session, study_id)
