"""Export of a study as a streamed zip and the history of earlier exports (FR-64 to FR-67)."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import ApiError
from app.models.enums import EntryType, StudyRole
from app.schemas.export import ExportHistoryResponse
from app.security.audit import record
from app.security.deps import StudyAccess, require_study_role
from app.services.export import (
    MEDIA_ENTRY_TYPES,
    ExportFilter,
    build_export,
    export_history,
)
from app.services.storage import DOWNLOAD_CHUNK_BYTES

router = APIRouter(prefix="/studies/{study_id}", tags=["export"])

study_member = require_study_role()


@router.get("/export")
def export_study(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: Annotated[StudyAccess, Depends(study_member)],
    include_location: bool = False,
    include_identity: bool = False,
    include_media: bool = False,
    media_type: Annotated[list[EntryType] | None, Query()] = None,
    include_csv: bool = True,
    scope: Literal["all", "filtered"] = "all",
    participant_id: uuid.UUID | None = None,
    activity_id: uuid.UUID | None = None,
    entry_type: EntryType | None = None,
    tag_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    free_only: bool = False,
    late_only: bool = False,
) -> StreamingResponse:
    if include_identity and not access.is_admin and access.role != StudyRole.PRINCIPAL_INVESTIGATOR:
        raise ApiError(
            403,
            "forbidden",
            "Only the study owner may include identity in an export.",
        )

    requested_media = set(media_type or [])
    selected_media = (
        [kind for kind in MEDIA_ENTRY_TYPES if kind in requested_media] if include_media else []
    )
    if include_media and not selected_media:
        selected_media = list(MEDIA_ENTRY_TYPES)
    # Without the media option the zip always keeps its CSV tables, as before (FR-65).
    include_csv = include_csv or not include_media

    export_filter = None
    if scope == "filtered":
        export_filter = ExportFilter(
            participant_id=participant_id,
            activity_id=activity_id,
            entry_type=entry_type,
            tag_id=tag_id,
            date_from=date_from,
            date_to=date_to,
            q=q,
            free_only=free_only,
            late_only=late_only,
        )

    built = build_export(
        session,
        study_id,
        include_location=include_location,
        include_identity=include_identity,
        include_media=include_media,
        media_types=selected_media,
        include_csv=include_csv,
        export_filter=export_filter,
    )
    try:
        record(
            session,
            access.user,
            "export",
            target=str(study_id),
            details={
                "format": "zip",
                "files": built.file_names,
                "entry_count": built.entry_count,
                "scope": scope,
                "filter": export_filter.audit_details() if export_filter is not None else None,
                "include_location": include_location,
                "include_identity": include_identity,
                "include_media": include_media,
                "media_types": [kind.value for kind in selected_media],
                "media_file_count": built.media_file_count,
                "unavailable_media_count": built.unavailable_count,
                "include_csv": include_csv,
            },
        )
        session.commit()
    except Exception:
        built.file.close()
        raise

    def stream():
        try:
            while chunk := built.file.read(DOWNLOAD_CHUNK_BYTES):
                yield chunk
        finally:
            built.file.close()

    return StreamingResponse(
        stream(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="fieldnote-export-{study_id}.zip"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/exports", response_model=ExportHistoryResponse)
def list_exports(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return export_history(session, study_id)
