"""Business logic for the activities of a study."""

import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Activity, UserAccount
from app.schemas.activities import ActivityCreate, ActivityUpdate
from app.security.audit import record
from app.services.studies import ensure_writable, get_study

ACTIVITY_FIELDS = (
    "title",
    "instructions",
    "entry_types",
    "options",
    "prompts_per_day",
    "window_start",
    "window_end",
    "min_gap_minutes",
    "capture_location",
    "allow_free_entries",
    "max_free_entries_per_day",
    "expected_minutes",
)


def list_activities(session: Session, study_id: uuid.UUID) -> list[Activity]:
    statement = (
        select(Activity).where(Activity.study_id == study_id).order_by(Activity.title, Activity.id)
    )
    return list(session.scalars(statement).all())


def get_activity(session: Session, study_id: uuid.UUID, activity_id: uuid.UUID) -> Activity:
    activity = session.get(Activity, activity_id)
    if activity is None or activity.study_id != study_id:
        raise ApiError(404, "activity_not_found", "The activity does not exist.")
    return activity


def _apply(activity: Activity, validated: ActivityCreate) -> None:
    activity.title = validated.title
    activity.instructions = validated.instructions
    activity.entry_types = [entry_type.value for entry_type in validated.entry_types]
    activity.options = (
        validated.options.model_dump(exclude_none=True) if validated.options is not None else None
    )
    activity.prompts_per_day = validated.prompts_per_day
    activity.window_start = validated.window_start
    activity.window_end = validated.window_end
    activity.min_gap_minutes = validated.min_gap_minutes
    activity.capture_location = validated.capture_location
    activity.allow_free_entries = validated.allow_free_entries
    activity.max_free_entries_per_day = validated.max_free_entries_per_day
    activity.expected_minutes = validated.expected_minutes


def create_activity(
    session: Session, actor: UserAccount, study_id: uuid.UUID, payload: ActivityCreate
) -> Activity:
    study = get_study(session, study_id)
    ensure_writable(study)
    activity = Activity(study_id=study_id)
    _apply(activity, payload)
    session.add(activity)
    session.flush()
    record(
        session,
        actor,
        "activity_created",
        target=str(activity.id),
        details={"study_id": str(study_id), "title": activity.title},
    )
    session.commit()
    return activity


def update_activity(
    session: Session,
    actor: UserAccount,
    study_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
) -> Activity:
    study = get_study(session, study_id)
    ensure_writable(study)
    activity = get_activity(session, study_id, activity_id)

    merged = {field: getattr(activity, field) for field in ACTIVITY_FIELDS}
    changes = payload.model_dump(exclude_unset=True)
    merged.update(changes)
    try:
        validated = ActivityCreate.model_validate(merged)
    except ValidationError as exc:
        raise ApiError(422, "validation_error", "Request validation failed.") from exc

    _apply(activity, validated)
    record(
        session,
        actor,
        "activity_updated",
        target=str(activity.id),
        details={"study_id": str(study_id), "fields": sorted(changes)},
    )
    session.commit()
    return activity


def delete_activity(
    session: Session, actor: UserAccount, study_id: uuid.UUID, activity_id: uuid.UUID
) -> None:
    study = get_study(session, study_id)
    ensure_writable(study)
    activity = get_activity(session, study_id, activity_id)
    session.delete(activity)
    record(
        session,
        actor,
        "activity_deleted",
        target=str(activity_id),
        details={"study_id": str(study_id)},
    )
    session.commit()
