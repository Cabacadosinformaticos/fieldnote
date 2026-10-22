"""Study codes for posters and leaflets: create, list, change, switch and regenerate."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models import InviteCode, Study
from app.schemas.invite_codes import StudyCodeCreate, StudyCodeOut, StudyCodeUpdate
from app.security.deps import StudyAccess, require_study_role
from app.services import invite_codes as service

router = APIRouter(prefix="/studies/{study_id}/invite-codes", tags=["invite-codes"])

_member = require_study_role()
MemberAccess = Annotated[StudyAccess, Depends(_member)]


def _study(session: Session, study_id: uuid.UUID) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    return study


def _out(code: InviteCode, counts: dict[str, int] | None = None) -> StudyCodeOut:
    counts = counts or {"waiting_count": 0, "approved_count": 0, "declined_count": 0}
    return StudyCodeOut(
        id=code.id,
        name=code.name or "",
        code=code.code_value or "",
        max_uses=code.max_uses,
        max_per_hour=code.max_per_hour,
        uses=code.uses,
        expires_at=code.expires_at,
        active=code.active,
        requires_approval=code.requires_approval,
        requires_account=code.requires_account,
        created_by=code.created_by,
        created_at=code.created_at,
        state=service.state_of(code),
        **counts,
    )


@router.post("", status_code=201, response_model=StudyCodeOut)
def create_study_code(
    study_id: uuid.UUID,
    payload: StudyCodeCreate,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> StudyCodeOut:
    study = _study(session, study_id)
    code = service.create_study_code(
        session,
        study,
        access.user,
        name=payload.name,
        end_date=payload.end_date,
        max_uses=payload.max_uses,
        max_per_hour=payload.max_per_hour,
        requires_approval=payload.requires_approval,
        requires_account=payload.requires_account,
    )
    return _out(code)


@router.get("", response_model=list[StudyCodeOut])
def list_study_codes(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: MemberAccess,
) -> list[StudyCodeOut]:
    _study(session, study_id)
    codes = service.list_study_codes(session, study_id)
    counts = service.usage_counts(session, [code.id for code in codes])
    return [_out(code, counts[code.id]) for code in codes]


@router.patch("/{code_id}", response_model=StudyCodeOut)
def update_study_code(
    study_id: uuid.UUID,
    code_id: uuid.UUID,
    payload: StudyCodeUpdate,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> StudyCodeOut:
    study = _study(session, study_id)
    code = service.get_study_code(session, study_id, code_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes:
        service.update_study_code(session, study, code, changes, access.user)
    counts = service.usage_counts(session, [code.id])
    return _out(code, counts[code.id])


@router.post("/{code_id}/regenerate", response_model=StudyCodeOut)
def regenerate_study_code(
    study_id: uuid.UUID,
    code_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: MemberAccess,
) -> StudyCodeOut:
    study = _study(session, study_id)
    code = service.get_study_code(session, study_id, code_id)
    service.regenerate_study_code(session, study, code, access.user)
    counts = service.usage_counts(session, [code.id])
    return _out(code, counts[code.id])
