"""Business logic for the researcher side of participants and approvals."""

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    Availability,
    Consent,
    Entry,
    InviteCode,
    Participant,
    ParticipantIdentity,
    Prompt,
    Study,
    StudyAnswer,
    UserAccount,
)
from app.models.enums import InviteCodeKind, ParticipantStatus, PromptStatus
from app.security import codes
from app.security.audit import record

PERSONAL_CODE_DAYS = 7

_ALIAS_PATTERN = re.compile(r"^P-(\d+)$")


def get_participant(
    session: Session, study_id: uuid.UUID, participant_id: uuid.UUID
) -> Participant:
    participant = session.get(Participant, participant_id)
    if participant is None or participant.study_id != study_id:
        raise ApiError(
            404, "participant_not_found", "The participant does not exist in this study."
        )
    return participant


def list_participants(session: Session, study_id: uuid.UUID) -> list[Participant]:
    return list(
        session.scalars(
            select(Participant)
            .where(Participant.study_id == study_id)
            .order_by(
                Participant.entered_at.asc().nulls_last(),
                Participant.alias.asc().nulls_last(),
                Participant.id,
            )
        )
    )


@dataclass(frozen=True)
class ParticipantMetadata:
    consented_at: datetime | None
    last_entry_at: datetime | None
    availability: list[Availability]


def participant_metadata(
    session: Session, participants: list[Participant]
) -> dict[uuid.UUID, ParticipantMetadata]:
    """Consent, last entry and availability for every row, in three grouped queries."""
    if not participants:
        return {}
    ids = [participant.id for participant in participants]
    consented = dict(
        session.execute(
            select(Consent.participant_id, func.max(Consent.accepted_at))
            .where(Consent.participant_id.in_(ids))
            .group_by(Consent.participant_id)
        ).all()
    )
    last_entries = dict(
        session.execute(
            select(Entry.participant_id, func.max(Entry.received_at))
            .where(Entry.participant_id.in_(ids))
            .group_by(Entry.participant_id)
        ).all()
    )
    availability: dict[uuid.UUID, list[Availability]] = defaultdict(list)
    for row in session.scalars(
        select(Availability)
        .where(Availability.participant_id.in_(ids))
        .order_by(Availability.participant_id, Availability.start_time, Availability.id)
    ):
        availability[row.participant_id].append(row)
    return {
        participant.id: ParticipantMetadata(
            consented_at=consented.get(participant.id),
            last_entry_at=last_entries.get(participant.id),
            availability=availability.get(participant.id, []),
        )
        for participant in participants
    }


def entry_routes(session: Session, participants: list[Participant]) -> dict[uuid.UUID, str | None]:
    """Derive how each participant entered.

    The schema records the study code that admitted a person but not whether a personal code was
    scanned or typed, so those two cases share ``personal_code``. A row with no code and a time of
    entry can only have come from the volunteer pool.
    """
    if not participants:
        return {}

    ids = [participant.id for participant in participants]
    personal_ids = set(
        session.scalars(
            select(InviteCode.participant_id).where(
                InviteCode.kind == InviteCodeKind.PERSONAL,
                InviteCode.participant_id.in_(ids),
            )
        )
    )
    admitted_ids = {
        participant.admitted_by_code_id
        for participant in participants
        if participant.admitted_by_code_id is not None
    }
    admitted_kinds: dict[uuid.UUID, InviteCodeKind] = {}
    if admitted_ids:
        admitted_kinds = dict(
            session.execute(
                select(InviteCode.id, InviteCode.kind).where(InviteCode.id.in_(admitted_ids))
            ).all()
        )

    routes: dict[uuid.UUID, str | None] = {}
    for participant in participants:
        admitted = (
            admitted_kinds.get(participant.admitted_by_code_id)
            if participant.admitted_by_code_id is not None
            else None
        )
        if admitted == InviteCodeKind.STUDY:
            routes[participant.id] = "study_code"
        elif participant.id in personal_ids or admitted == InviteCodeKind.PERSONAL:
            routes[participant.id] = "personal_code"
        elif participant.entered_at is not None:
            routes[participant.id] = "pool"
        else:
            routes[participant.id] = None
    return routes


def _new_personal_code(session: Session) -> str:
    for _ in range(20):
        raw = codes.generate_personal_code()
        if (
            session.scalar(
                select(InviteCode.id).where(InviteCode.code_hash == codes.hash_code(raw))
            )
            is None
        ):
            return raw
    raise ApiError(503, "code_generation_failed", "Could not generate an invite code.")


def issue_personal_code(
    session: Session, participant: Participant, actor: UserAccount
) -> tuple[InviteCode, str]:
    """Replace every unused personal code of the participant with a new 7-day one."""
    session.execute(
        sa_delete(InviteCode).where(
            InviteCode.kind == InviteCodeKind.PERSONAL,
            InviteCode.participant_id == participant.id,
            InviteCode.used_at.is_(None),
        )
    )
    raw = _new_personal_code(session)
    code = InviteCode(
        study_id=participant.study_id,
        kind=InviteCodeKind.PERSONAL,
        code_hash=codes.hash_code(raw),
        participant_id=participant.id,
        expires_at=datetime.now(UTC) + timedelta(days=PERSONAL_CODE_DAYS),
        active=True,
        requires_approval=False,
        requires_account=False,
        created_by=actor.id,
    )
    session.add(code)
    session.flush()
    record(
        session,
        actor,
        "participant_invite_issued",
        target=str(participant.id),
        details={"study_id": str(participant.study_id), "invite_code_id": str(code.id)},
    )
    return code, raw


def add_participant(
    session: Session,
    study_id: uuid.UUID,
    actor: UserAccount,
    *,
    alias: str,
    name: str | None,
    email: str | None,
) -> tuple[Participant, InviteCode, str]:
    alias = alias.strip()
    if not alias:
        raise ApiError(422, "validation_error", "The alias cannot be empty.")
    participant = Participant(
        study_id=study_id,
        alias=alias,
        status=ParticipantStatus.ACTIVE,
    )
    session.add(participant)
    session.flush()

    name = name.strip() if name and name.strip() else None
    email = email.strip() if email and email.strip() else None
    if name is not None or email is not None:
        session.add(ParticipantIdentity(participant_id=participant.id, name=name, email=email))

    code, raw = issue_personal_code(session, participant, actor)
    record(
        session,
        actor,
        "participant_added",
        target=str(participant.id),
        details={"study_id": str(study_id)},
    )
    session.commit()
    return participant, code, raw


def remove_participant(
    session: Session, participant: Participant, actor: UserAccount
) -> Participant:
    participant.status = ParticipantStatus.REMOVED
    session.execute(
        sa_delete(Prompt).where(
            Prompt.participant_id == participant.id,
            Prompt.status == PromptStatus.PLANNED,
            Prompt.sent_at.is_(None),
        )
    )
    record(
        session,
        actor,
        "participant_removed",
        target=str(participant.id),
        details={"study_id": str(participant.study_id)},
    )
    session.commit()
    return participant


def read_identity(
    session: Session, participant: Participant, actor: UserAccount
) -> ParticipantIdentity | None:
    identity = session.get(ParticipantIdentity, participant.id)
    record(
        session,
        actor,
        "participant_identity_read",
        target=str(participant.id),
        details={"study_id": str(participant.study_id)},
    )
    session.commit()
    return identity


def list_waiting(
    session: Session, study_id: uuid.UUID
) -> list[tuple[int, Participant, InviteCode | None]]:
    rows = session.execute(
        select(Participant, InviteCode)
        .outerjoin(InviteCode, Participant.admitted_by_code_id == InviteCode.id)
        .where(
            Participant.study_id == study_id,
            Participant.status == ParticipantStatus.PENDING_APPROVAL,
        )
        .order_by(Participant.entered_at.asc().nulls_last(), Participant.id)
    ).all()
    return [(index, participant, code) for index, (participant, code) in enumerate(rows, start=1)]


def _next_alias(session: Session, study_id: uuid.UUID) -> str:
    aliases = set(
        session.scalars(
            select(Participant.alias).where(
                Participant.study_id == study_id, Participant.alias.like("P-%")
            )
        )
    )
    numbers = [
        int(match.group(1))
        for alias in aliases
        if alias is not None and (match := _ALIAS_PATTERN.match(alias)) is not None
    ]
    number = max(numbers, default=0) + 1
    candidate = f"P-{number:02d}"
    while candidate in aliases:
        number += 1
        candidate = f"P-{number:02d}"
    return candidate


def approve_participant(
    session: Session, participant: Participant, actor: UserAccount
) -> Participant:
    if participant.status != ParticipantStatus.PENDING_APPROVAL:
        raise ApiError(
            409, "participant_not_pending", "The participant is not waiting for approval."
        )
    # Serialise approvals of one study so two of them cannot pick the same next alias.
    session.execute(select(Study.id).where(Study.id == participant.study_id).with_for_update())
    participant.alias = _next_alias(session, participant.study_id)
    participant.status = ParticipantStatus.ACTIVE
    participant.decided_by = actor.id
    participant.decided_at = datetime.now(UTC)
    record(
        session,
        actor,
        "participant_approved",
        target=str(participant.id),
        details={"study_id": str(participant.study_id)},
    )
    session.commit()
    return participant


def decline_participant(
    session: Session, participant: Participant, actor: UserAccount
) -> Participant:
    if participant.status != ParticipantStatus.PENDING_APPROVAL:
        raise ApiError(
            409, "participant_not_pending", "The participant is not waiting for approval."
        )
    participant.status = ParticipantStatus.DECLINED
    participant.push_token = None
    participant.decided_by = actor.id
    participant.decided_at = datetime.now(UTC)
    session.execute(sa_delete(Consent).where(Consent.participant_id == participant.id))
    session.execute(sa_delete(StudyAnswer).where(StudyAnswer.participant_id == participant.id))
    session.execute(sa_delete(Availability).where(Availability.participant_id == participant.id))
    if participant.admitted_by_code_id is not None:
        session.execute(
            update(InviteCode)
            .where(InviteCode.id == participant.admitted_by_code_id)
            .values(uses=func.greatest(InviteCode.uses - 1, 0))
        )
    record(
        session,
        actor,
        "participant_declined",
        target=str(participant.id),
        details={"study_id": str(participant.study_id)},
    )
    session.commit()
    return participant
