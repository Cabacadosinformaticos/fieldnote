"""Researcher reads: entries with filters and detail, the timeline and the adherence matrix."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.enums import EntryType
from app.schemas.entries_read import (
    AdherenceResponse,
    EntryListResponse,
    EntryOut,
    EntryTagsOut,
    EntryTagsUpdate,
    MediaRetryOut,
    TimelineResponse,
)
from app.security.deps import StudyAccess, require_study_role
from app.services import entries_read

router = APIRouter(prefix="/studies/{study_id}", tags=["entries"])

study_member = require_study_role()


@router.get("/entries", response_model=EntryListResponse)
def list_entries(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
    participant_id: uuid.UUID | None = None,
    activity_id: uuid.UUID | None = None,
    entry_type: EntryType | None = None,
    tag_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    free_only: bool = False,
    late_only: bool = False,
    cursor: str | None = None,
    limit: Annotated[
        int, Query(ge=1, le=entries_read.MAX_PAGE_SIZE)
    ] = entries_read.DEFAULT_PAGE_SIZE,
) -> dict[str, object]:
    return entries_read.list_entries(
        session,
        study_id,
        participant_id=participant_id,
        activity_id=activity_id,
        entry_type=entry_type,
        tag_id=tag_id,
        date_from=date_from,
        date_to=date_to,
        q=q,
        free_only=free_only,
        late_only=late_only,
        cursor=cursor,
        limit=limit,
    )


@router.get("/entries/{entry_id}", response_model=EntryOut)
def entry_detail(
    study_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return entries_read.get_entry(session, study_id, entry_id, access.user)


@router.post("/entries/{entry_id}/media/retry", response_model=MediaRetryOut)
def retry_entry_media(
    study_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return entries_read.retry_media(session, study_id, entry_id, access.user)


@router.put("/entries/{entry_id}/tags", response_model=EntryTagsOut)
def set_entry_tags(
    study_id: uuid.UUID,
    entry_id: uuid.UUID,
    payload: EntryTagsUpdate,
    session: Annotated[Session, Depends(get_session)],
    access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return entries_read.set_entry_tags(session, study_id, entry_id, payload.tag_ids, access.user)


@router.get("/timeline", response_model=TimelineResponse)
def timeline(
    study_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
    participant_id: uuid.UUID | None = None,
    activity_id: uuid.UUID | None = None,
    entry_type: EntryType | None = None,
    tag_id: uuid.UUID | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    zoom: Literal["week", "day", "hours"] = "day",
) -> dict[str, object]:
    return entries_read.timeline(
        session,
        study_id,
        participant_id=participant_id,
        activity_id=activity_id,
        entry_type=entry_type,
        tag_id=tag_id,
        start=start,
        end=end,
        zoom=zoom,
    )


@router.get("/participants/{participant_id}/adherence", response_model=AdherenceResponse)
def adherence(
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    _access: Annotated[StudyAccess, Depends(study_member)],
) -> dict[str, object]:
    return entries_read.adherence(session, study_id, participant_id)
