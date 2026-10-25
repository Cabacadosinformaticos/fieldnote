"""The volunteer pool: joining, the profile, invitations and their acceptance.

A pool member is not a participant: the row has no study, no alias and no consent, and nothing in
the participant row created on acceptance refers back to the member. Researchers only ever send
criteria and receive a count; a group below five is hidden and invitations to it are refused.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import any_, func, literal, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    AccountParticipation,
    Consent,
    Participant,
    PoolInvitation,
    PoolMember,
    Study,
    UserAccount,
)
from app.models.enums import ParticipantStatus, PoolInvitationStatus
from app.schemas.pool import (
    MINIMUM_GROUP_SIZE,
    PoolCriteria,
    PoolInvitationAcceptRequest,
    PoolJoinRequest,
    PoolProfileUpdate,
)
from app.security import codes
from app.security.audit import record
from app.services import outbox
from app.services import participation as participation_service

INVITATION_DAYS = 7
POOL_INVITATION_EVENT = "pool.invitation_created"
# The notification says only that there is a new study; it carries no name and no criteria (FR-77).
POOL_INVITATION_TEXT = "Há um novo estudo em que pode participar."


@dataclass(frozen=True)
class PoolAcceptance:
    participant: Participant
    device_token: str
    invitation: PoolInvitation


def _clean_token(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _language_values(languages: list[object] | None) -> list[str] | None:
    if not languages:
        return None
    values = [
        language.value if hasattr(language, "value") else str(language)
        for language in dict.fromkeys(languages)
    ]
    return values or None


def join_pool(session: Session, profile: PoolJoinRequest) -> tuple[PoolMember, str]:
    now = datetime.now(UTC)
    raw = codes.generate_device_token()
    member = PoolMember(
        credential_hash=codes.hash_device_token(raw),
        push_token=_clean_token(profile.push_token),
        concelho=profile.concelho,
        freguesia=profile.freguesia,
        age_band=profile.age_band,
        gender=profile.gender,
        occupation=profile.occupation,
        usual_transport=profile.usual_transport,
        languages=_language_values(profile.languages),
        invitations_paused=False,
        joined_at=now,
    )
    session.add(member)
    session.commit()
    return member, raw


def member_for_credential(session: Session, raw_credential: str) -> PoolMember | None:
    digest = codes.hash_device_token(raw_credential.strip())
    member = session.scalar(select(PoolMember).where(PoolMember.credential_hash == digest))
    if member is None or member.credential_hash is None:
        return None
    return member if codes.same_hash(member.credential_hash, digest) else None


def update_profile(session: Session, member: PoolMember, changes: dict[str, object]) -> PoolMember:
    if "languages" in changes:
        member.languages = _language_values(changes.pop("languages"))
    if "push_token" in changes:
        changes["push_token"] = _clean_token(changes["push_token"])
    for field, value in changes.items():
        setattr(member, field, value)
    session.commit()
    return member


def leave_pool(session: Session, member: PoolMember) -> None:
    """Delete the profile and its credential at once; the invitations lose their member."""
    session.delete(member)
    session.commit()


def _conditions(criteria: PoolCriteria) -> list[object]:
    conditions: list[object] = [PoolMember.invitations_paused.is_(False)]
    if criteria.concelho is not None:
        conditions.append(PoolMember.concelho == criteria.concelho)
    if criteria.freguesia is not None:
        conditions.append(PoolMember.freguesia == criteria.freguesia)
    if criteria.age_band is not None:
        conditions.append(PoolMember.age_band == criteria.age_band)
    if criteria.gender is not None:
        conditions.append(PoolMember.gender == criteria.gender)
    if criteria.occupation is not None:
        conditions.append(PoolMember.occupation == criteria.occupation)
    if criteria.usual_transport is not None:
        conditions.append(PoolMember.usual_transport == criteria.usual_transport)
    if criteria.language is not None:
        # ``ARRAY.contains`` is only implemented on the dialect ARRAY type; ``= ANY`` is portable.
        conditions.append(literal(criteria.language.value) == any_(PoolMember.languages))
    return conditions


def count_matching(session: Session, criteria: PoolCriteria) -> int | None:
    """A count below five is never returned as a number (NFR-68)."""
    count = session.scalar(
        select(func.count()).select_from(PoolMember).where(*_conditions(criteria))
    )
    total = count or 0
    return total if total >= MINIMUM_GROUP_SIZE else None


def send_invitations(
    session: Session, user: UserAccount, study: Study, criteria: PoolCriteria
) -> tuple[int, datetime]:
    members = list(
        session.scalars(select(PoolMember).where(*_conditions(criteria)).order_by(PoolMember.id))
    )
    if len(members) < MINIMUM_GROUP_SIZE:
        raise ApiError(
            409,
            "pool_group_too_small",
            "Invitations are not sent to a group of fewer than 5 people.",
        )

    now = datetime.now(UTC)
    expires_at = now + timedelta(days=INVITATION_DAYS)
    for member in members:
        invitation = PoolInvitation(
            study_id=study.id,
            pool_member_id=member.id,
            status=PoolInvitationStatus.SENT,
            sent_at=now,
            expires_at=expires_at,
        )
        session.add(invitation)
        session.flush()
        if member.push_token:
            outbox.enqueue(
                session,
                POOL_INVITATION_EVENT,
                {
                    "invitation_id": str(invitation.id),
                    "push_token": member.push_token,
                    "text": POOL_INVITATION_TEXT,
                },
            )
    record(
        session,
        user,
        "pool_invitations_sent",
        target=str(study.id),
        details={
            "study_id": str(study.id),
            "criteria": criteria.model_dump(mode="json", exclude_none=True),
            "sent": len(members),
        },
    )
    session.commit()
    return len(members), expires_at


def _expire_if_due(invitation: PoolInvitation, now: datetime) -> bool:
    if invitation.status == PoolInvitationStatus.SENT and invitation.expires_at <= now:
        invitation.status = PoolInvitationStatus.EXPIRED
        return True
    return False


def list_invitations(session: Session, member: PoolMember) -> list[PoolInvitation]:
    now = datetime.now(UTC)
    invitations = list(
        session.scalars(
            select(PoolInvitation)
            .where(PoolInvitation.pool_member_id == member.id)
            .order_by(PoolInvitation.sent_at.desc(), PoolInvitation.id)
        )
    )
    changed = False
    for invitation in invitations:
        changed = _expire_if_due(invitation, now) or changed
    if changed:
        session.commit()
    return invitations


def get_invitation(
    session: Session, member: PoolMember, invitation_id: uuid.UUID
) -> PoolInvitation:
    invitation = session.get(PoolInvitation, invitation_id, with_for_update=True)
    if invitation is None or invitation.pool_member_id != member.id:
        raise ApiError(404, "invitation_not_found", "The invitation does not exist.")
    if _expire_if_due(invitation, datetime.now(UTC)):
        session.commit()
    return invitation


def _existing_participation(
    session: Session, member: PoolMember, study: Study, digest: str | None
) -> Participant | AccountParticipation | None:
    if digest is not None:
        matched = session.scalar(
            select(Participant).where(
                Participant.study_id == study.id, Participant.device_hash == digest
            )
        )
        if (
            matched is not None
            and matched.device_hash is not None
            and codes.same_hash(matched.device_hash, digest)
        ):
            return matched
    if member.account_id is not None:
        return session.scalar(
            select(AccountParticipation).where(
                AccountParticipation.account_id == member.account_id,
                AccountParticipation.study_id == study.id,
            )
        )
    return None


def accept_invitation(
    session: Session,
    member: PoolMember,
    invitation_id: uuid.UUID,
    request: PoolInvitationAcceptRequest,
) -> PoolAcceptance:
    invitation = get_invitation(session, member, invitation_id)
    now = datetime.now(UTC)
    if invitation.status == PoolInvitationStatus.EXPIRED:
        raise ApiError(409, "invitation_expired", "The invitation has expired.")
    if invitation.status != PoolInvitationStatus.SENT:
        raise ApiError(409, "invitation_already_answered", "The invitation was already answered.")
    if invitation.expires_at <= now:
        invitation.status = PoolInvitationStatus.EXPIRED
        session.commit()
        raise ApiError(409, "invitation_expired", "The invitation has expired.")

    study = session.get(Study, invitation.study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")

    digest = participation_service.compute_device_hash(study, request.android_id)
    if _existing_participation(session, member, study, digest) is not None:
        # The invitation is not used up; the person is taken to the existing participation.
        raise ApiError(
            409,
            "already_participating",
            "This phone or account already takes part in this study.",
        )

    # The question validation and the alias numbering are shared with joining by code so that the
    # two routes cannot drift.
    prepared = participation_service._prepare_answers(
        session,
        study,
        [(answer.question_id, answer.answer) for answer in request.answers],
    )
    raw = codes.generate_device_token()
    participant = Participant(
        study_id=study.id,
        alias=participation_service._next_alias(session, study.id),
        device_token_hash=codes.hash_device_token(raw),
        device_hash=digest,
        entered_at=now,
        locale=request.locale,
        status=ParticipantStatus.ACTIVE,
    )
    session.add(participant)
    session.flush()
    session.add(
        Consent(
            participant_id=participant.id,
            version=request.consent_version,
            accepted_at=now,
        )
    )
    participation_service._store_answers(session, participant, prepared, now)
    if member.account_id is not None:
        session.add(
            AccountParticipation(
                participant_id=participant.id,
                account_id=member.account_id,
                study_id=study.id,
            )
        )
    invitation.status = PoolInvitationStatus.ACCEPTED
    invitation.responded_at = now
    session.commit()
    return PoolAcceptance(participant=participant, device_token=raw, invitation=invitation)


def decline_invitation(
    session: Session, member: PoolMember, invitation_id: uuid.UUID
) -> PoolInvitation:
    invitation = get_invitation(session, member, invitation_id)
    now = datetime.now(UTC)
    if invitation.status == PoolInvitationStatus.EXPIRED:
        raise ApiError(409, "invitation_expired", "The invitation has expired.")
    if invitation.status != PoolInvitationStatus.SENT:
        raise ApiError(409, "invitation_already_answered", "The invitation was already answered.")
    invitation.status = PoolInvitationStatus.DECLINED
    invitation.responded_at = now
    session.commit()
    return invitation


def profile_changes(payload: PoolProfileUpdate) -> dict[str, object]:
    return payload.model_dump(exclude_unset=True)
