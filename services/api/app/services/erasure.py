"""Permanent erasure of one participant, shared by the administrator path and the system job.

The database cascades remove the identity, the consent, the availability, the answers to the
study questions, the prompts, the entries, the media records, the personal invite codes and the
account link. The object storage files are removed first, under the participant's key prefix, so
a failure leaves the participant row in place and the job can retry; deleting a prefix that is
already empty is not an error, which makes the operation idempotent.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Entry, Participant, UserAccount
from app.models.enums import ParticipantStatus
from app.security.audit import record
from app.services import storage

ERASED_ACTION = "participant_erased"
PARTICIPANT_NOT_FOUND = "The participant does not exist."
ERASURE_SCHEDULED = "An erasure started in the app cannot be brought forward."


@dataclass(frozen=True)
class ErasureResult:
    participant_id: uuid.UUID
    entries: int
    files: int


def _count_entries(session: Session, participant_id: uuid.UUID) -> int:
    return (
        session.scalar(
            select(func.count()).select_from(Entry).where(Entry.participant_id == participant_id)
        )
        or 0
    )


def erase_participant(
    session: Session,
    participant: Participant,
    *,
    actor: UserAccount | None = None,
    delete_files: Callable[[uuid.UUID], int] | None = None,
) -> ErasureResult:
    """Delete one participant's rows and files and write the audit row.

    The caller holds a row lock on the participant. ``actor`` is ``None`` for the system job.
    The audit row carries the pseudonymous id, the study and counts only, never an identity.
    """
    remover = delete_files or storage.delete_participant_objects
    participant_id = participant.id
    study_id = participant.study_id
    entries = _count_entries(session, participant_id)
    files = remover(participant_id)

    session.delete(participant)
    session.flush()
    record(
        session,
        actor,
        ERASED_ACTION,
        target=str(participant_id),
        details={"study_id": str(study_id), "entries": entries, "files": files},
    )
    session.commit()
    return ErasureResult(participant_id=participant_id, entries=entries, files=files)


def erase_participant_now(
    session: Session, actor: UserAccount, participant_id: uuid.UUID
) -> ErasureResult:
    """The administrator path of FR-44: erase a participant immediately."""
    participant = session.scalar(
        select(Participant).where(Participant.id == participant_id).with_for_update()
    )
    if participant is None:
        raise ApiError(404, "participant_not_found", PARTICIPANT_NOT_FOUND)
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(409, "erasure_scheduled", ERASURE_SCHEDULED)
    return erase_participant(session, participant, actor=actor)
