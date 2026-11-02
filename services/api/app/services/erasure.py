"""Permanent erasure of one participant, shared by the administrator path and the system job.

The database cascades remove the identity, the consent, the availability, the answers to the
study questions, the prompts, the entries, the media records, the personal invite codes and the
account link. The object storage files are removed *after* that removal is committed (FR-44): a
storage failure therefore can never bring the rows back. ``erasure_file_deletion`` records the
files that are still due, so the job retries them; deleting a prefix that is already empty is not
an error, which makes the operation idempotent.

Staged uploads (media rows with no entry yet) do not cascade from the participant, so they are
deleted explicitly by the ``entries/{participant_id}/`` key prefix.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Entry, ErasureFileDeletion, MediaObject, Participant, UserAccount
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


def _lock_participant(session: Session, participant_id: uuid.UUID) -> Participant | None:
    """Claim the participant at the moment of the deletion.

    The batch select in the job releases its locks on the per-participant commits, so every
    erasure takes its own lock here. ``SKIP LOCKED`` keeps two replicas from waiting on the
    same row; a row another replica already deleted comes back as ``None``.
    """
    return session.scalar(
        select(Participant)
        .where(Participant.id == participant_id)
        .with_for_update(skip_locked=True)
    )


def complete_file_deletion(
    session: Session,
    participant_id: uuid.UUID,
    *,
    files: int,
    actor: UserAccount | None = None,
) -> bool:
    """Remove the pending marker and write ``participant_erased`` when this worker wins.

    Returns ``False`` when another worker already settled the files. The conditional delete is
    what makes exactly one ``participant_erased`` row per participant even when the job and the
    administrator race each other.
    """
    pending = session.scalar(
        select(ErasureFileDeletion)
        .where(ErasureFileDeletion.participant_id == participant_id)
        .with_for_update(skip_locked=True)
    )
    if pending is None:
        session.rollback()
        return False
    study_id = pending.study_id
    entries = pending.entries
    session.delete(pending)
    session.flush()
    record(
        session,
        actor,
        ERASED_ACTION,
        target=str(participant_id),
        details={"study_id": str(study_id), "entries": entries, "files": files},
    )
    session.commit()
    return True


def erase_participant(
    session: Session,
    participant: Participant,
    *,
    actor: UserAccount | None = None,
    delete_files: Callable[[uuid.UUID], int] | None = None,
) -> ErasureResult | None:
    """Delete one participant's rows and files and write the audit row.

    The database commit happens before the objects are touched. ``actor`` is ``None`` for the
    system job. The audit row carries the pseudonymous id, the study and counts only, never an
    identity. Returns ``None`` when the participant was already erased by another worker.
    """
    remover = delete_files or storage.delete_participant_objects
    participant_id = participant.id
    locked = _lock_participant(session, participant_id)
    if locked is None:
        return None

    study_id = locked.study_id
    entries = _count_entries(session, participant_id)
    session.execute(
        delete(MediaObject).where(MediaObject.object_key.like(f"entries/{participant_id}/%"))
    )
    session.add(
        ErasureFileDeletion(
            participant_id=participant_id,
            study_id=study_id,
            entries=entries,
        )
    )
    session.delete(locked)
    session.commit()

    files = remover(participant_id)
    complete_file_deletion(session, participant_id, files=files, actor=actor)
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
    result = erase_participant(session, participant, actor=actor)
    if result is None:
        raise ApiError(404, "participant_not_found", PARTICIPANT_NOT_FOUND)
    return result
