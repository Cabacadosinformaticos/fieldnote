"""Business logic for reusable study codes for posters and leaflets."""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import InviteCode, Participant, Study, UserAccount
from app.models.enums import InviteCodeKind, ParticipantStatus
from app.security import codes
from app.security.audit import record

# Fields that cannot be cleared with a PATCH body; only the two limits can be removed.
_REQUIRED_UPDATE_FIELDS = frozenset(
    {"name", "end_date", "requires_approval", "requires_account", "active"}
)


def _today(study: Study) -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(study.timezone)).date()


def end_of_day(study: Study, on: date) -> datetime:
    """The last instant of ``on`` in the study's time zone, stored as UTC."""
    start_of_next_day = datetime.combine(
        on + timedelta(days=1), time.min, tzinfo=ZoneInfo(study.timezone)
    )
    return (start_of_next_day - timedelta(microseconds=1)).astimezone(UTC)


def _validate_end_date(study: Study, on: date) -> None:
    if on < _today(study):
        raise ApiError(422, "invalid_end_date", "The end date cannot be in the past.")


def _new_code_value(session: Session) -> str:
    for _ in range(20):
        raw = codes.generate_study_code()
        if session.scalar(select(InviteCode.id).where(InviteCode.code_value == raw)) is None:
            return raw
    raise ApiError(503, "code_generation_failed", "Could not generate a study code.")


def get_study_code(session: Session, study_id: uuid.UUID, code_id: uuid.UUID) -> InviteCode:
    code = session.get(InviteCode, code_id)
    if code is None or code.study_id != study_id or code.kind != InviteCodeKind.STUDY:
        raise ApiError(404, "study_code_not_found", "The study code does not exist in this study.")
    return code


def list_study_codes(session: Session, study_id: uuid.UUID) -> list[InviteCode]:
    return list(
        session.scalars(
            select(InviteCode)
            .where(InviteCode.study_id == study_id, InviteCode.kind == InviteCodeKind.STUDY)
            .order_by(InviteCode.created_at, InviteCode.id)
        )
    )


def create_study_code(
    session: Session,
    study: Study,
    actor: UserAccount,
    *,
    name: str,
    end_date: date,
    max_uses: int | None,
    max_per_hour: int | None,
    requires_approval: bool,
    requires_account: bool,
) -> InviteCode:
    _validate_end_date(study, end_date)
    name = name.strip()
    if not name:
        raise ApiError(422, "validation_error", "The name cannot be empty.")
    code = InviteCode(
        study_id=study.id,
        kind=InviteCodeKind.STUDY,
        code_value=_new_code_value(session),
        name=name,
        max_uses=max_uses,
        max_per_hour=max_per_hour,
        expires_at=end_of_day(study, end_date),
        active=True,
        requires_approval=requires_approval,
        requires_account=requires_account,
        created_by=actor.id,
    )
    session.add(code)
    session.flush()
    session.refresh(code)
    record(
        session,
        actor,
        "study_code_created",
        target=str(code.id),
        details={"study_id": str(study.id), "name": code.name},
    )
    session.commit()
    return code


def update_study_code(
    session: Session, study: Study, code: InviteCode, changes: dict[str, Any], actor: UserAccount
) -> InviteCode:
    for field in changes:
        if field in _REQUIRED_UPDATE_FIELDS and changes[field] is None:
            raise ApiError(422, "validation_error", f"{field} cannot be empty.")

    if "end_date" in changes:
        _validate_end_date(study, changes["end_date"])
        code.expires_at = end_of_day(study, changes["end_date"])
    if "name" in changes:
        name = changes["name"].strip()
        if not name:
            raise ApiError(422, "validation_error", "The name cannot be empty.")
        code.name = name
    for field in ("max_uses", "max_per_hour", "requires_approval", "requires_account"):
        if field in changes:
            setattr(code, field, changes[field])

    switched_off = "active" in changes and not changes["active"]
    switched_on = "active" in changes and changes["active"]
    if "active" in changes:
        code.active = changes["active"]

    if switched_off:
        action = "study_code_switched_off"
    elif switched_on:
        action = "study_code_switched_on"
    else:
        action = "study_code_updated"
    record(
        session,
        actor,
        action,
        target=str(code.id),
        details={"study_id": str(study.id), "fields": sorted(changes)},
    )
    session.commit()
    return code


def regenerate_study_code(
    session: Session, study: Study, code: InviteCode, actor: UserAccount
) -> InviteCode:
    code.code_value = _new_code_value(session)
    record(
        session,
        actor,
        "study_code_regenerated",
        target=str(code.id),
        details={"study_id": str(study.id)},
    )
    session.commit()
    return code


def state_of(code: InviteCode, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    if not code.active:
        return "off"
    if now > code.expires_at:
        return "ended"
    if code.max_uses is not None and code.uses >= code.max_uses:
        return "limit_reached"
    return "active"


def usage_counts(session: Session, code_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, int]]:
    """Waiting, approved and declined entries of each code, for the dashboard list."""
    counts = {
        code_id: {"waiting_count": 0, "approved_count": 0, "declined_count": 0}
        for code_id in code_ids
    }
    if not code_ids:
        return counts
    rows = session.execute(
        select(Participant.admitted_by_code_id, Participant.status, func.count())
        .where(Participant.admitted_by_code_id.in_(code_ids))
        .group_by(Participant.admitted_by_code_id, Participant.status)
    ).all()
    for code_id, status, count in rows:
        if code_id is None:
            continue
        if status == ParticipantStatus.PENDING_APPROVAL:
            counts[code_id]["waiting_count"] += count
        elif status == ParticipantStatus.DECLINED:
            counts[code_id]["declined_count"] += count
        else:
            counts[code_id]["approved_count"] += count
    return counts
