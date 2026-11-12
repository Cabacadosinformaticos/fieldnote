"""Erasure requests the research team passes to the administrator (UC17, FR-44, FR-85).

The request records the team's decision, not the participant's wish: the team decides whether
Article 17 applies and only then asks the administrator to erase. The administrator still runs
the erasure through the FR-44 path; this module only keeps the queue around it.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
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


def create_request(
    session: Session,
    study_id: uuid.UUID,
    participant_id: uuid.UUID,
    user: UserAccount,
    received_at: datetime,
) -> ErasureRequest:
    participant = _participant_for_update(session, study_id, participant_id)
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(409, "erasure_scheduled", ERASURE_SCHEDULED)
    if pending_request(session, study_id, participant_id) is not None:
        raise ApiError(409, "erasure_request_pending", REQUEST_EXISTS)

    request = ErasureRequest(
        study_id=study_id,
        participant_id=participant_id,
        requested_by=user.id,
        received_at=received_at,
        status="pending",
    )
    session.add(request)
    session.flush()
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
    session: Session, participant_id: uuid.UUID, admin: UserAccount
) -> ErasureRequest | None:
    """Close the pending request before FR-44 removes the participant.

    The ``erasure_request.participant_id`` foreign key cascades, so the row itself disappears
    with the participant it names. The audit row written here is the durable record that the
    request was handled.
    """
    request = session.scalar(
        select(ErasureRequest)
        .where(ErasureRequest.participant_id == participant_id, ErasureRequest.status == "pending")
        .with_for_update()
    )
    if request is None:
        return None

    done_at = datetime.now(UTC)
    request.status = "done"
    request.done_at = done_at
    request.done_by = admin.id
    record(
        session,
        admin,
        DONE_ACTION,
        target=str(participant_id),
        details={
            "request_id": str(request.id),
            "study_id": str(request.study_id),
            "received_at": request.received_at.isoformat(),
            "done_at": done_at.isoformat(),
        },
    )
    session.commit()
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
