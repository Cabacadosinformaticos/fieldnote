"""Erasure requests the research team passes to the administrator (UC17, FR-44, FR-85).

The request records the team's decision, not the participant's wish: the team decides whether
Article 17 applies and only then asks the administrator to erase. The administrator still runs
the erasure through the FR-44 path; this module only keeps the queue around it.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    AuditLog,
    Entry,
    ErasureRequest,
    MediaObject,
    Participant,
    ParticipantIdentity,
    Study,
    StudyMember,
    UserAccount,
)
from app.models.enums import ParticipantStatus
from app.security.audit import record

CREATED_ACTION = "erasure_request_created"
CANCELLED_ACTION = "erasure_request_cancelled"
DONE_ACTION = "erasure_request_done"

PARTICIPANT_NOT_FOUND = "The participant does not exist in this study."
REQUEST_NOT_FOUND = "There is no pending erasure request for this participant."
REQUEST_EXISTS = "This participant already has a pending erasure request."
ERASURE_SCHEDULED = "An erasure started in the app cannot be requested through the team."
STUDY_NOT_FOUND = "The study does not exist."
RECEIVED_IN_FUTURE = "The date the request was received cannot be in the future."
RECEIVED_BEFORE_STUDY = "The date the request was received cannot be before the study was created."


@dataclass(frozen=True)
class RequestCounts:
    entries: int
    files: int
    entry_types: dict[str, int]
    has_identity: bool
    study_participants: int
    study_entries: int


@dataclass(frozen=True)
class PendingRequest:
    request: ErasureRequest
    participant: Participant
    study: Study
    requested_by_name: str | None
    requested_by_role: str | None
    counts: RequestCounts


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _study_timezone(study: Study) -> ZoneInfo:
    try:
        return ZoneInfo(study.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _validate_received_at(session: Session, study: Study, received_at: datetime) -> None:
    """Refuse a date after today in the study, or before the study itself existed."""
    zone = _study_timezone(study)
    end_of_today = datetime.combine(
        datetime.now(UTC).astimezone(zone).date(), time.max, tzinfo=zone
    ).astimezone(UTC)
    moment = _as_utc(received_at)
    if moment > end_of_today:
        raise ApiError(422, "received_at_in_future", RECEIVED_IN_FUTURE)

    created_at = session.scalar(
        select(AuditLog.at)
        .where(
            AuditLog.action == "study_created",
            AuditLog.target == str(study.id),
        )
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    # The dialog asks for a day, so compare days: a request received on the day the study was
    # created is valid whatever the hour of either.
    if created_at is not None and (
        moment.astimezone(zone).date() < _as_utc(created_at).astimezone(zone).date()
    ):
        raise ApiError(422, "received_at_before_study", RECEIVED_BEFORE_STUDY)


def _participant_for_update(
    session: Session, study_id: uuid.UUID, participant_id: uuid.UUID
) -> Participant:
    participant = session.scalar(
        select(Participant)
        .where(Participant.id == participant_id, Participant.study_id == study_id)
        .with_for_update()
    )
    if participant is None:
        raise ApiError(404, "participant_not_found", PARTICIPANT_NOT_FOUND)
    return participant


def pending_request(
    session: Session, study_id: uuid.UUID, participant_id: uuid.UUID
) -> ErasureRequest | None:
    return session.scalar(
        select(ErasureRequest)
        .where(
            ErasureRequest.study_id == study_id,
            ErasureRequest.participant_id == participant_id,
            ErasureRequest.status == "pending",
        )
        .order_by(ErasureRequest.created_at.desc())
        .limit(1)
    )


def pending_for_participant(session: Session, participant_id: uuid.UUID) -> ErasureRequest | None:
    """The pending request of one participant, found before the erasure removes the row."""
    return session.scalar(
        select(ErasureRequest)
        .where(
            ErasureRequest.participant_id == participant_id,
            ErasureRequest.status == "pending",
        )
        .order_by(ErasureRequest.created_at.desc())
        .limit(1)
    )


def create_request(
    session: Session,
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    user: UserAccount,
    received_at: datetime,
) -> ErasureRequest:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", STUDY_NOT_FOUND)
    _validate_received_at(session, study, received_at)

    participant = _participant_for_update(session, study_id, participant_id)
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(409, "erasure_scheduled", ERASURE_SCHEDULED)
    if pending_request(session, study_id, participant_id) is not None:
        raise ApiError(409, "erasure_request_pending", REQUEST_EXISTS)

    request = ErasureRequest(
        study_id=study_id,
        participant_id=participant_id,
        participant_alias=participant.alias or str(participant_id),
        requested_by=user.id,
        received_at=received_at,
        status="pending",
    )
    session.add(request)
    try:
        session.flush()
    except IntegrityError:
        # A concurrent request slipped past the check; the partial unique index is the final
        # word and the administrator sees the same 409 as for a second request.
        session.rollback()
        raise ApiError(409, "erasure_request_pending", REQUEST_EXISTS) from None
    record(
        session,
        user,
        CREATED_ACTION,
        target=str(participant_id),
        details={
            "request_id": str(request.id),
            "study_id": str(study_id),
            "received_at": received_at.isoformat(),
        },
    )
    session.commit()
    return request


def cancel_request(
    session: Session, study_id: uuid.UUID, participant_id: uuid.UUID, user: UserAccount
) -> ErasureRequest:
    request = session.scalar(
        select(ErasureRequest)
        .where(
            ErasureRequest.study_id == study_id,
            ErasureRequest.participant_id == participant_id,
            ErasureRequest.status == "pending",
        )
        .with_for_update()
    )
    if request is None:
        raise ApiError(404, "erasure_request_not_found", REQUEST_NOT_FOUND)

    request.status = "cancelled"
    record(
        session,
        user,
        CANCELLED_ACTION,
        target=str(participant_id),
        details={"request_id": str(request.id), "study_id": str(study_id)},
    )
    session.commit()
    return request


def mark_done(
    session: Session,
    request_id: uuid.UUID,
    actor: UserAccount | None,
    *,
    participant_id: uuid.UUID,
    entries: int,
    files: int,
) -> ErasureRequest | None:
    """Close the pending request after FR-44 removed the participant.

    ``actor`` is the administrator or ``None`` when the erasure job ran the erasure. The caller
    owns the commit, so the request and the ``participant_erased`` row land together. The
    participant foreign key is ``ON DELETE SET NULL`` and the alias and counts are copied into
    the request, so the row survives the erasure and the administrator's list still says who
    was erased and what was removed.
    """
    request = session.scalar(
        select(ErasureRequest).where(ErasureRequest.id == request_id).with_for_update()
    )
    if request is None or request.status != "pending":
        return None

    done_at = datetime.now(UTC)
    request.status = "done"
    request.done_at = done_at
    request.done_by = actor.id if actor is not None else None
    request.entries = entries
    request.files = files
    record(
        session,
        actor,
        DONE_ACTION,
        target=str(participant_id),
        details={
            "request_id": str(request.id),
            "study_id": str(request.study_id),
            "received_at": request.received_at.isoformat(),
            "done_at": done_at.isoformat(),
            "entries": entries,
            "files": files,
        },
    )
    session.flush()
    return request


def pending_for_erased_participant(
    session: Session, participant_id: uuid.UUID
) -> ErasureRequest | None:
    """The pending request of a participant whose row the erasure has already removed.

    The participant foreign key has become null, so the request is found through the
    ``erasure_request_created`` row, which targets the participant and carries the request id.
    """
    raw_request_id = session.scalar(
        select(AuditLog.details.op("->>")("request_id"))
        .where(
            AuditLog.action == CREATED_ACTION,
            AuditLog.target == str(participant_id),
        )
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    if not isinstance(raw_request_id, str):
        return None
    try:
        request_id = uuid.UUID(raw_request_id)
    except ValueError:
        return None
    request = session.get(ErasureRequest, request_id)
    if request is None or request.status != "pending":
        return None
    return request


def _requester_names(session: Session, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    return {
        user.id: user.name or user.email
        for user in session.scalars(select(UserAccount).where(UserAccount.id.in_(user_ids)))
    }


def _member_roles(
    session: Session, pairs: set[tuple[uuid.UUID, uuid.UUID]]
) -> dict[tuple[uuid.UUID, uuid.UUID], str]:
    if not pairs:
        return {}
    study_ids = {study_id for study_id, _ in pairs}
    user_ids = {user_id for _, user_id in pairs}
    rows = session.execute(
        select(StudyMember.study_id, StudyMember.user_id, StudyMember.role).where(
            StudyMember.study_id.in_(study_ids), StudyMember.user_id.in_(user_ids)
        )
    )
    return {(row.study_id, row.user_id): str(row.role) for row in rows}


def list_pending(session: Session) -> list[PendingRequest]:
    rows = session.execute(
        select(ErasureRequest, Participant, Study)
        .join(Participant, Participant.id == ErasureRequest.participant_id)
        .join(Study, Study.id == ErasureRequest.study_id)
        .where(ErasureRequest.status == "pending")
        .order_by(ErasureRequest.received_at.asc(), ErasureRequest.id)
    ).all()
    if not rows:
        return []

    participant_ids = {participant.id for _, participant, _ in rows}
    study_ids = {study.id for _, _, study in rows}
    requester_ids = {request.requested_by for request, _, _ in rows if request.requested_by}

    names = _requester_names(session, requester_ids)
    pairs = {
        (request.study_id, request.requested_by) for request, _, _ in rows if request.requested_by
    }
    roles = _member_roles(session, pairs)

    entry_counts: dict[uuid.UUID, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for participant_id, entry_type, count in session.execute(
        select(Entry.participant_id, Entry.entry_type, func.count())
        .where(Entry.participant_id.in_(participant_ids))
        .group_by(Entry.participant_id, Entry.entry_type)
    ):
        entry_counts[participant_id][str(entry_type)] = count

    files = {
        participant_id: session.scalar(
            select(func.count())
            .select_from(MediaObject)
            .where(MediaObject.object_key.like(f"entries/{participant_id}/%"))
        )
        or 0
        for participant_id in participant_ids
    }
    with_identity = set(
        session.scalars(
            select(ParticipantIdentity.participant_id).where(
                ParticipantIdentity.participant_id.in_(participant_ids)
            )
        )
    )
    study_participants = dict(
        session.execute(
            select(Participant.study_id, func.count())
            .where(Participant.study_id.in_(study_ids))
            .group_by(Participant.study_id)
        ).all()
    )
    study_entries = dict(
        session.execute(
            select(Participant.study_id, func.count(Entry.id))
            .join(Entry, Entry.participant_id == Participant.id)
            .where(Participant.study_id.in_(study_ids))
            .group_by(Participant.study_id)
        ).all()
    )

    pending: list[PendingRequest] = []
    for request, participant, study in rows:
        by_type = dict(entry_counts[participant.id])
        pending.append(
            PendingRequest(
                request=request,
                participant=participant,
                study=study,
                requested_by_name=(
                    names.get(request.requested_by) if request.requested_by else None
                ),
                requested_by_role=(
                    roles.get((request.study_id, request.requested_by))
                    if request.requested_by
                    else None
                ),
                counts=RequestCounts(
                    entries=sum(by_type.values()),
                    files=files.get(participant.id, 0),
                    entry_types=by_type,
                    has_identity=participant.id in with_identity,
                    study_participants=study_participants.get(study.id, 0),
                    study_entries=study_entries.get(study.id, 0),
                ),
            )
        )
    return pending
