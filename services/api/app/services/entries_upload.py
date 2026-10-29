"""Signed media uploads and entry submission.

An entry is created on the phone: the phone chooses its UUID and the SHA-256 of its content
before sending. The API therefore inserts with ``ON CONFLICT DO NOTHING`` and uses the hash to
tell a duplicate resend (200) from a UUID collision (409).
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Activity, Entry, MediaObject, Participant, Prompt, Study
from app.models.enums import EntryType, MediaStatus, ParticipantStatus, PromptStatus
from app.schemas.entries_upload import EntrySubmitRequest, MediaUploadRequest
from app.security.audit import record
from app.services import outbox, storage

MIB = 1024 * 1024
MEDIA_LIMITS: dict[str, int] = {
    "image/gif": 25 * MIB,
    "image/heic": 25 * MIB,
    "image/heif": 25 * MIB,
    "image/jpeg": 25 * MIB,
    "image/png": 25 * MIB,
    "image/webp": 25 * MIB,
    "audio/3gpp": 100 * MIB,
    "audio/aac": 100 * MIB,
    "audio/amr": 100 * MIB,
    "audio/mp4": 100 * MIB,
    "audio/mpeg": 100 * MIB,
    "audio/ogg": 100 * MIB,
    "audio/wav": 100 * MIB,
    "audio/webm": 100 * MIB,
    "audio/x-wav": 100 * MIB,
    "video/3gpp": 500 * MIB,
    "video/mp4": 500 * MIB,
    "video/quicktime": 500 * MIB,
    "video/webm": 500 * MIB,
}
MIME_PREFIX_BY_ENTRY_TYPE = {
    EntryType.PHOTO: "image/",
    EntryType.AUDIO: "audio/",
    EntryType.VIDEO: "video/",
}
SCALE_TYPES = frozenset({"numbers", "faces", "text", "slider"})
MAX_MEDIA_PER_ENTRY = 10


@dataclass(frozen=True)
class UploadTicket:
    media: MediaObject
    upload_url: str
    expires_at: datetime


@dataclass(frozen=True)
class SubmissionResult:
    id: uuid.UUID
    duplicate: bool
    received_at: datetime


def request_upload_url(
    session: Session, participant: Participant, payload: MediaUploadRequest
) -> UploadTicket:
    _require_active(participant, "upload media")
    mime_type = payload.mime_type.strip().lower()
    max_bytes = MEDIA_LIMITS.get(mime_type)
    if max_bytes is None:
        raise ApiError(
            422,
            "unsupported_media_type",
            "The file type must be an image, audio or video type the platform accepts.",
        )
    if payload.size_bytes > max_bytes:
        raise ApiError(422, "media_too_large", "The file is larger than the activity allows.")

    media_id = uuid.uuid4()
    object_key = storage.upload_object_key(participant.id, payload.entry_id, media_id)
    upload_url, expires_at = storage.presign_put(object_key, mime_type, payload.size_bytes)

    media = MediaObject(
        id=media_id,
        entry_id=None,
        object_key=object_key,
        mime_type=mime_type,
        size_bytes=payload.size_bytes,
        sha256=payload.sha256.lower(),
        status=MediaStatus.PENDING,
    )
    session.add(media)
    record(
        session,
        participant,
        "media_upload_url_issued",
        target=str(media_id),
        details={
            "entry_id": str(payload.entry_id),
            "object_key": object_key,
            "mime_type": mime_type,
            "size_bytes": payload.size_bytes,
        },
    )
    session.commit()
    return UploadTicket(media=media, upload_url=upload_url, expires_at=expires_at)


def submit_entry(
    session: Session, participant: Participant, payload: EntrySubmitRequest
) -> SubmissionResult:
    _require_active(participant, "submit entries")

    content_sha256 = payload.content_sha256.lower()
    existing = session.get(Entry, payload.id)
    if existing is not None:
        return _resolve_existing(existing, participant, content_sha256)

    activity = _find_activity(session, participant, payload.activity_id)
    prompt = _find_prompt(session, participant, activity, payload.prompt_id)
    _validate_fields(payload, activity)
    if prompt is None:
        _check_free_entry(session, participant, activity, payload.recorded_at)
    media_objects = _validate_media(session, participant, payload)

    statement = (
        pg_insert(Entry)
        .values(
            id=payload.id,
            participant_id=participant.id,
            prompt_id=prompt.id if prompt is not None else None,
            activity_id=activity.id,
            entry_type=payload.entry_type,
            content_sha256=content_sha256,
            recorded_at=payload.recorded_at,
            body=payload.body,
            value=payload.value,
            scale_shown=payload.scale_shown,
            choice=payload.choice,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        .on_conflict_do_nothing(index_elements=[Entry.id])
        .returning(Entry.id, Entry.received_at)
    )
    inserted = session.execute(statement).one_or_none()
    if inserted is None:
        # Another replica won the race for this UUID; treat it like a resend.
        existing = session.get(Entry, payload.id)
        if existing is None:
            raise ApiError(409, "entry_conflict", "The entry id is already in use.")
        return _resolve_existing(existing, participant, content_sha256)

    received_at = inserted.received_at
    if media_objects:
        session.execute(
            update(MediaObject)
            .where(MediaObject.id.in_([media.id for media in media_objects]))
            .values(entry_id=payload.id, status=MediaStatus.UPLOADED)
        )
    if prompt is not None:
        prompt.status = PromptStatus.ANSWERED

    for media in media_objects:
        outbox.enqueue_media_process(session, media)
    outbox.enqueue_entry_created(
        session,
        entry_id=payload.id,
        participant_id=participant.id,
        study_id=participant.study_id,
        entry_type=payload.entry_type.value,
        recorded_at=payload.recorded_at,
        received_at=received_at,
    )
    record(
        session,
        participant,
        "entry_created",
        target=str(payload.id),
        details={
            "entry_type": payload.entry_type.value,
            "prompt_id": str(prompt.id) if prompt is not None else None,
        },
    )
    session.commit()
    return SubmissionResult(id=payload.id, duplicate=False, received_at=received_at)


def _resolve_existing(
    existing: Entry, participant: Participant, content_sha256: str
) -> SubmissionResult:
    if (
        existing.participant_id == participant.id
        and existing.content_sha256.lower() == content_sha256
    ):
        return SubmissionResult(id=existing.id, duplicate=True, received_at=existing.received_at)
    raise ApiError(
        409,
        "entry_conflict",
        "An entry with this id already exists with different content.",
    )


def _require_active(participant: Participant, action: str) -> None:
    if participant.status != ParticipantStatus.ACTIVE:
        raise ApiError(
            403,
            "participant_not_active",
            f"Only an active participant can {action}.",
        )


def _find_activity(session: Session, participant: Participant, activity_id: uuid.UUID) -> Activity:
    activity = session.get(Activity, activity_id)
    if activity is None or activity.study_id != participant.study_id:
        raise ApiError(404, "activity_not_found", "The activity does not exist in this study.")
    return activity


def _find_prompt(
    session: Session,
    participant: Participant,
    activity: Activity,
    prompt_id: uuid.UUID | None,
) -> Prompt | None:
    if prompt_id is None:
        return None
    prompt = session.get(Prompt, prompt_id)
    if prompt is None or prompt.participant_id != participant.id:
        raise ApiError(404, "prompt_not_found", "The prompt does not exist for this participant.")
    if prompt.activity_id != activity.id:
        raise ApiError(422, "prompt_activity_mismatch", "The prompt belongs to another activity.")
    return prompt


def _validate_fields(payload: EntrySubmitRequest, activity: Activity) -> None:
    entry_type = payload.entry_type
    if entry_type.value not in set(activity.entry_types):
        raise ApiError(422, "entry_type_not_allowed", "The activity does not accept this type.")

    if payload.scale_shown is not None and entry_type != EntryType.SCALE:
        raise ApiError(422, "scale_shown_unexpected", "Only scale entries carry scale_shown.")
    if payload.choice is not None and entry_type != EntryType.CHOICE:
        raise ApiError(422, "choice_unexpected", "Only choice entries carry a choice.")
    if payload.value is not None and entry_type != EntryType.SCALE:
        raise ApiError(422, "value_unexpected", "Only scale entries carry a value.")

    media_prefix = MIME_PREFIX_BY_ENTRY_TYPE.get(entry_type)
    if media_prefix is None and payload.media_object_ids:
        raise ApiError(422, "media_not_allowed", "This entry type does not carry media files.")
    if media_prefix is not None and not payload.media_object_ids:
        raise ApiError(422, "media_required", "This entry type needs at least one media file.")

    if entry_type == EntryType.TEXT and (payload.body is None or not payload.body.strip()):
        raise ApiError(422, "body_required", "A text entry needs a body.")
    if entry_type == EntryType.SCALE:
        _validate_scale(payload, activity)
    if entry_type == EntryType.CHOICE:
        _validate_choice(payload, activity)

    _validate_location(payload, activity)


def _validate_scale(payload: EntrySubmitRequest, activity: Activity) -> None:
    if payload.value is None:
        raise ApiError(422, "value_required", "A scale entry needs the chosen value.")
    if payload.scale_shown is None:
        raise ApiError(422, "scale_shown_required", "A scale entry needs the scale as shown.")

    options = activity.options or {}
    if options.get("scale_type") is None:
        raise ApiError(409, "scale_not_configured", "The activity has no response scale.")
    invalid = ApiError(422, "scale_invalid", "The scale as shown does not match the activity.")
    if options["scale_type"] != payload.scale_shown.get("scale_type"):
        raise invalid
    scale_type = payload.scale_shown.get("scale_type")
    if scale_type not in SCALE_TYPES:
        raise invalid

    value = payload.value
    if scale_type == "slider":
        if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100:
            raise ApiError(422, "scale_value_out_of_range", "The slider value must be 0 to 100.")
        return

    points = payload.scale_shown.get("points")
    if not isinstance(points, int) or isinstance(points, bool) or not 2 <= points <= 11:
        raise invalid
    if options.get("points") is not None and points != options["points"]:
        raise invalid
    # An eleven-point numbers scale shows 0 to 10 (FR-111); the other scales count from 1.
    lowest = 0 if scale_type == "numbers" and points == 11 else 1
    highest = 10 if scale_type == "numbers" and points == 11 else points
    if not lowest <= value <= highest:
        raise ApiError(
            422,
            "scale_value_out_of_range",
            f"The value must be between {lowest} and {highest}.",
        )


def _validate_choice(payload: EntrySubmitRequest, activity: Activity) -> None:
    if payload.choice is None or not payload.choice.strip():
        raise ApiError(422, "choice_required", "A choice entry needs the chosen option.")
    choices = (activity.options or {}).get("choices")
    if isinstance(choices, list) and payload.choice not in choices:
        raise ApiError(422, "choice_invalid", "The chosen option is not part of the activity.")


def _validate_location(payload: EntrySubmitRequest, activity: Activity) -> None:
    if (payload.latitude is None) != (payload.longitude is None):
        raise ApiError(422, "location_incomplete", "Both coordinates must be sent together.")
    if payload.latitude is not None and not activity.capture_location:
        raise ApiError(422, "location_not_requested", "The activity does not request location.")


def free_entries_used_today(
    session: Session,
    participant: Participant,
    activity: Activity,
    at: datetime,
) -> int:
    """Free entries of this activity in the local day of ``at`` (FR-13)."""
    study = session.get(Study, participant.study_id)
    timezone = ZoneInfo(study.timezone if study is not None else "UTC")
    local_day: date = at.astimezone(timezone).date()
    day_start = datetime.combine(local_day, time.min, tzinfo=timezone)
    day_end = day_start + timedelta(days=1)
    used = session.scalar(
        select(func.count())
        .select_from(Entry)
        .where(
            Entry.participant_id == participant.id,
            Entry.activity_id == activity.id,
            Entry.prompt_id.is_(None),
            Entry.recorded_at >= day_start,
            Entry.recorded_at < day_end,
        )
    )
    return used or 0


def _check_free_entry(
    session: Session,
    participant: Participant,
    activity: Activity,
    recorded_at: datetime,
) -> None:
    if not activity.allow_free_entries:
        raise ApiError(403, "free_entries_not_allowed", "The activity does not allow free entries.")
    if activity.max_free_entries_per_day is None:
        return
    used = free_entries_used_today(session, participant, activity, recorded_at)
    if used >= activity.max_free_entries_per_day:
        raise ApiError(409, "free_entry_limit_reached", "The daily limit of free entries is used.")


def _validate_media(
    session: Session, participant: Participant, payload: EntrySubmitRequest
) -> list[MediaObject]:
    ids = payload.media_object_ids
    if len(set(ids)) != len(ids):
        raise ApiError(422, "duplicate_media_object", "A media file was sent twice.")
    if len(ids) > MAX_MEDIA_PER_ENTRY:
        raise ApiError(422, "too_many_media", "An entry carries too many media files.")

    rows = session.scalars(select(MediaObject).where(MediaObject.id.in_(ids))).all()
    by_id = {media.id: media for media in rows}
    if len(by_id) != len(ids):
        raise ApiError(409, "media_object_not_found", "A media object does not exist.")

    prefix = storage.upload_object_prefix(participant.id, payload.id)
    expected_prefix = MIME_PREFIX_BY_ENTRY_TYPE.get(payload.entry_type)
    for media_id in ids:
        media = by_id[media_id]
        if not media.object_key.startswith(prefix):
            raise ApiError(409, "media_object_not_found", "A media object does not belong here.")
        if media.entry_id is not None and media.entry_id != payload.id:
            raise ApiError(409, "media_object_attached", "A media object belongs to another entry.")
        if media.status == MediaStatus.FAILED:
            raise ApiError(409, "media_processing_failed", "The media file could not be processed.")
        if expected_prefix is None or not media.mime_type.startswith(expected_prefix):
            raise ApiError(
                422, "media_type_mismatch", "A media file does not match the entry type."
            )
        if not storage.object_exists(media.object_key):
            raise ApiError(409, "media_not_uploaded", "The media file has not been uploaded.")
    return [by_id[media_id] for media_id in ids]
