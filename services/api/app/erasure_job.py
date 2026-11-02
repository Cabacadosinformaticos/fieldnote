"""Run the permanent erasures that are due.

Run with ``python -m app.erasure_job``. The job selects the participants whose erasure was
requested in the app and whose due time has passed, then runs the erasure of FR-44 and writes the
audit row. Every participant is locked inside its own erasure (``SKIP LOCKED``) instead of through
a batch lock that the per-participant commits would release. Several replicas may run the job at
the same time: each row is processed by one of them, and a row that disappears before its turn is
already erased.

The database rows are deleted before the objects, so a storage failure is retried from the
``erasure_file_deletion`` row left behind, not from the participant (which no longer exists).
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, cast, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import AuditLog, ErasureFileDeletion, Participant
from app.models.enums import ParticipantStatus
from app.security.audit import record
from app.services import erasure, storage

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


def _due_participants(
    session: Session,
    now: datetime,
    batch_size: int,
    attempted: set[uuid.UUID] | None = None,
) -> list[Participant]:
    statement = select(Participant).where(
        Participant.status == ParticipantStatus.ERASURE_SCHEDULED,
        Participant.erasure_due_at.is_not(None),
        Participant.erasure_due_at <= now,
    )
    if attempted:
        statement = statement.where(Participant.id.not_in(attempted))
    return list(
        session.scalars(
            statement.order_by(Participant.erasure_due_at, Participant.id).limit(batch_size)
        )
    )


def _retry_pending_files(session: Session) -> int:
    """Finish erasures whose objects could not be deleted after the database commit."""
    ids = list(session.scalars(select(ErasureFileDeletion.participant_id)))
    handled = 0
    for participant_id in ids:
        if session.get(ErasureFileDeletion, participant_id) is None:
            continue
        try:
            files = storage.delete_participant_objects(participant_id)
        except Exception:
            # Keep the pending row for the next run: the database rows stay deleted.
            session.rollback()
            logger.exception(
                "cannot delete the files of participant %s yet; will retry", participant_id
            )
            continue
        if erasure.complete_file_deletion(session, participant_id, files=files):
            handled += 1
    return handled


def _audit_missing_requests(session: Session, now: datetime) -> int:
    """Write the audit row for a due request whose participation row no longer exists.

    A restore from a backup made during the seven days leaves no participant row for a pending
    erasure (NFR-13), so the job has nothing to delete and only records that the erasure is done
    (UC20, 5c). The request row is locked without waiting, so two replicas never write it twice.
    A participant whose files are still pending is skipped: its ``participant_erased`` row is
    written when the files are actually gone.
    """
    requests = session.scalars(
        select(AuditLog)
        .where(
            AuditLog.action == "erasure_requested",
            cast(AuditLog.details.op("->>")("due_at"), DateTime(timezone=True)) <= now,
        )
        .order_by(AuditLog.id)
        .with_for_update(skip_locked=True)
    ).all()
    written = 0
    for request in requests:
        if request.target is None:
            continue
        try:
            participant_id = uuid.UUID(request.target)
        except ValueError:
            continue
        if session.get(Participant, participant_id) is not None:
            continue
        if session.get(ErasureFileDeletion, participant_id) is not None:
            continue
        already = session.scalar(
            select(AuditLog.id)
            .where(
                AuditLog.action == erasure.ERASED_ACTION,
                AuditLog.target == request.target,
            )
            .limit(1)
        )
        if already is not None:
            continue
        record(
            session,
            None,
            erasure.ERASED_ACTION,
            target=request.target,
            details={"entries": 0, "files": 0},
        )
        session.commit()
        written += 1
    return written


def run_once(
    session: Session,
    *,
    now: datetime | None = None,
    batch_size: int = BATCH_SIZE,
) -> int:
    """Settle every erasure that is due and return how many were handled."""
    moment = now or datetime.now(UTC)
    handled = _retry_pending_files(session)
    attempted: set[uuid.UUID] = set()
    while True:
        due = _due_participants(session, moment, batch_size, attempted)
        if not due:
            break
        for participant in due:
            attempted.add(participant.id)
            try:
                result = erasure.erase_participant(session, participant)
            except Exception:
                session.rollback()
                logger.exception("cannot erase participant %s yet", participant.id)
                continue
            if result is not None:
                handled += 1
    return handled + _audit_missing_requests(session, moment)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        with SessionLocal() as session:
            erased = run_once(session)
    except SQLAlchemyError as exc:
        logger.error("erasure job failed: %s", exc)
        return 1
    logger.info("erasure job finished: %d participant(s) erased", erased)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
