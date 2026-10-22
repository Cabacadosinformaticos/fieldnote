"""Export of a study as a zip of CSV files (FR-64 to FR-67, FR-115, FR-116)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models.enums import StudyRole
from app.security.audit import record
from app.security.deps import StudyAccess, require_study_role
from app.services.export import build_export

router = APIRouter(prefix="/studies/{study_id}", tags=["export"])

study_member = require_study_role()


@router.get("/export")
def export_study(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: Annotated[StudyAccess, Depends(study_member)],
    include_location: bool = False,
    include_identity: bool = False,
) -> Response:
    if include_identity and not access.is_admin and access.role != StudyRole.PRINCIPAL_INVESTIGATOR:
        raise ApiError(
            403,
            "forbidden",
            "Only the study owner may include identity in an export.",
        )

    content, files = build_export(
        session,
        study_id,
        include_location=include_location,
        include_identity=include_identity,
    )
    record(
        session,
        access.user,
        "export",
        target=str(study_id),
        details={
            "format": "zip",
            "files": files,
            "include_location": include_location,
            "include_identity": include_identity,
        },
    )
    session.commit()

    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="fieldnote-export-{study_id}.zip"',
            "Cache-Control": "no-store",
        },
    )
