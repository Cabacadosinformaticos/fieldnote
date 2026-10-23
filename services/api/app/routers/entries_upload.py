"""Signed media uploads and entry submission for participants (device tokens)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Participant
from app.schemas.entries_upload import (
    EntrySubmitRequest,
    EntrySubmitResponse,
    MediaUploadRequest,
    MediaUploadResponse,
)
from app.security.deps import current_participant
from app.services import entries_upload

router = APIRouter(tags=["entries"])


@router.post("/media/upload-url", status_code=201, response_model=MediaUploadResponse)
def create_media_upload_url(
    payload: MediaUploadRequest,
    participant: Annotated[Participant, Depends(current_participant)],
    session: Annotated[Session, Depends(get_session)],
) -> MediaUploadResponse:
    ticket = entries_upload.request_upload_url(session, participant, payload)
    return MediaUploadResponse(
        media_object_id=ticket.media.id,
        upload_url=ticket.upload_url,
        method="PUT",
        headers={
            "Content-Type": ticket.media.mime_type,
            "Content-Length": str(ticket.media.size_bytes),
        },
        expires_at=ticket.expires_at,
    )


@router.post("/entries", response_model=EntrySubmitResponse)
def submit_entry(
    payload: EntrySubmitRequest,
    participant: Annotated[Participant, Depends(current_participant)],
    session: Annotated[Session, Depends(get_session)],
) -> EntrySubmitResponse:
    result = entries_upload.submit_entry(session, participant, payload)
    return EntrySubmitResponse(
        id=result.id,
        duplicate=result.duplicate,
        received_at=result.received_at,
    )
