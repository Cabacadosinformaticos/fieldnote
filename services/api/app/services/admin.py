"""Business logic for the administrator screens: accounts, studies and the audit log."""

import secrets
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    AuditLog,
    Entry,
    Participant,
    RefreshToken,
    Study,
    StudyMember,
    UserAccount,
)
from app.models.enums import AuditActorType, ParticipantStatus, StudyRole, UserRole
from app.security.audit import record
from app.security.passwords import hash_password
from app.services import account_links
from app.services.erasure import ERASED_ACTION

# The schema has no ``active`` column, so an account deactivated by an administrator is locked
# until this moment. The access token already issued keeps working until it expires (UC14).
LOCKED_UNTIL = datetime(9999, 12, 31, 23, 59, 59, tzinfo=UTC)

ACCOUNT_NOT_FOUND = "The account does not exist."
EMAIL_IN_USE = "An account already uses that email address."
COMPLETED_ERASURES_LIMIT = 100


@dataclass(frozen=True)
class AccountSummary:
    user: UserAccount
    studies: int
    last_session_at: datetime | None


@dataclass(frozen=True)
class StudyOverview:
    study: Study
    team: list[tuple[StudyMember, UserAccount]]
    owner_email: str | None
    participants: int
    entries: int


@dataclass(frozen=True)
class AuditPage:
    events: list[AuditLog]
    next_cursor: int | None


@dataclass(frozen=True)
class ErasureListing:
    scheduled: list[Participant]
    completed: list[AuditLog]
    next_cursor: int | None = None


def _get_account(session: Session, user_id: uuid.UUID) -> UserAccount:
    user = session.get(UserAccount, user_id)
    if user is None:
        raise ApiError(404, "account_not_found", ACCOUNT_NOT_FOUND)
    return user


def is_locked(user: UserAccount, now: datetime | None = None) -> bool:
    moment = now or datetime.now(UTC)
    return user.locked_until is not None and user.locked_until > moment


def is_deactivated(user: UserAccount) -> bool:
    return user.locked_until is not None and user.locked_until >= LOCKED_UNTIL


def account_state(user: UserAccount, now: datetime | None = None) -> str:
    if is_deactivated(user):
        return "deactivated"
    if is_locked(user, now):
        return "locked"
    return "active"


def list_accounts(session: Session) -> list[AccountSummary]:
    """Every account with the study count and last sign-in the accounts table shows."""
    users = list(session.scalars(select(UserAccount).order_by(UserAccount.email, UserAccount.id)))
    if not users:
        return []
    ids = [user.id for user in users]
    studies = dict(
        session.execute(
            select(StudyMember.user_id, func.count())
            .where(StudyMember.user_id.in_(ids))
            .group_by(StudyMember.user_id)
        ).all()
    )
    last_sessions = dict(
        session.execute(
            select(AuditLog.actor_id, func.max(AuditLog.at))
            .where(AuditLog.action == "login", AuditLog.actor_id.in_(ids))
            .group_by(AuditLog.actor_id)
        ).all()
    )
    return [
        AccountSummary(
            user=user,
            studies=studies.get(user.id, 0),
            last_session_at=last_sessions.get(user.id),
        )
        for user in users
    ]


def account_summary(session: Session, user: UserAccount) -> AccountSummary:
    studies = session.scalar(
        select(func.count()).select_from(StudyMember).where(StudyMember.user_id == user.id)
    )
    last_session_at = session.scalar(
        select(func.max(AuditLog.at)).where(
            AuditLog.action == "login", AuditLog.actor_id == user.id
        )
    )
    return AccountSummary(
        user=user,
        studies=studies or 0,
        last_session_at=last_session_at,
    )


def create_account(
    session: Session, actor: UserAccount, email: str, role: UserRole
) -> tuple[UserAccount, bool]:
    """Create an account that can only sign in after choosing a password from a mailed link."""
    normalised = email.strip().lower()
    if "@" not in normalised or normalised.startswith("@") or normalised.endswith("@"):
        raise ApiError(422, "invalid_email", "A valid email address is required.")
    existing = session.scalar(
        select(UserAccount.id).where(func.lower(UserAccount.email) == normalised)
    )
    if existing is not None:
        raise ApiError(409, "email_in_use", EMAIL_IN_USE)

    # Nobody holds this random password: only the single-use link can set one.
    user = UserAccount(
        email=normalised,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        role=role,
    )
    session.add(user)
    session.flush()
    record(
        session,
        actor,
        "account_created",
        target=str(user.id),
        details={"email": user.email, "role": role.value},
    )
    session.commit()
    session.refresh(user)
    mail_sent = account_links.send_link(session, actor, user)
    return user, mail_sent


def send_account_link(session: Session, actor: UserAccount, user_id: uuid.UUID) -> bool:
    """Mail a fresh single-use link, so an expired invitation is never a dead end."""
    user = _get_account(session, user_id)
    if is_deactivated(user):
        raise ApiError(409, "account_deactivated", "The account is deactivated.")
    return account_links.send_link(session, actor, user)


def change_role(
    session: Session, actor: UserAccount, user_id: uuid.UUID, role: UserRole
) -> UserAccount:
    user = _get_account(session, user_id)
    if user.id == actor.id:
        raise ApiError(409, "cannot_change_own_role", "You cannot change your own role.")
    if user.role == role:
        return user
    user.role = role
    record(
        session,
        actor,
        "account_role_changed",
        target=str(user.id),
        details={"email": user.email, "role": role.value},
    )
    session.commit()
    return user


def lock_account(session: Session, actor: UserAccount, user_id: uuid.UUID) -> UserAccount:
    """Deactivate an account: block sign-in and revoke every refresh token."""
    user = _get_account(session, user_id)
    if user.id == actor.id:
        raise ApiError(409, "cannot_lock_own_account", "You cannot lock your own account.")
    user.locked_until = LOCKED_UNTIL
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    record(
        session,
        actor,
        "account_locked",
        target=str(user.id),
        details={"email": user.email},
    )
    session.commit()
    return user


def unlock_account(session: Session, actor: UserAccount, user_id: uuid.UUID) -> UserAccount:
    user = _get_account(session, user_id)
    user.locked_until = None
    user.failed_logins = 0
    record(
        session,
        actor,
        "account_unlocked",
        target=str(user.id),
        details={"email": user.email},
    )
    session.commit()
    return user


def study_overview(session: Session) -> list[StudyOverview]:
    """Every study with its team, owner and the counts of FR-42."""
    studies = list(session.scalars(select(Study).order_by(Study.title, Study.id)))
    if not studies:
        return []

    ids = [study.id for study in studies]
    rows = session.execute(
        select(StudyMember, UserAccount)
        .join(UserAccount, UserAccount.id == StudyMember.user_id)
        .where(StudyMember.study_id.in_(ids))
        .order_by(StudyMember.study_id, UserAccount.email)
    ).all()
    teams: dict[uuid.UUID, list[tuple[StudyMember, UserAccount]]] = defaultdict(list)
    for member, account in rows:
        teams[member.study_id].append((member, account))

    participant_counts = dict(
        session.execute(
            select(Participant.study_id, func.count())
            .where(Participant.study_id.in_(ids))
            .group_by(Participant.study_id)
        ).all()
    )
    entry_counts = dict(
        session.execute(
            select(Participant.study_id, func.count(Entry.id))
            .join(Entry, Entry.participant_id == Participant.id)
            .where(Participant.study_id.in_(ids))
            .group_by(Participant.study_id)
        ).all()
    )

    overviews: list[StudyOverview] = []
    for study in studies:
        team = teams.get(study.id, [])
        owner = next(
            (
                account.email
                for member, account in team
                if member.role == StudyRole.PRINCIPAL_INVESTIGATOR
            ),
            None,
        )
        overviews.append(
            StudyOverview(
                study=study,
                team=team,
                owner_email=owner,
                participants=participant_counts.get(study.id, 0),
                entries=entry_counts.get(study.id, 0),
            )
        )
    return overviews


def list_audit(
    session: Session,
    *,
    actor_type: AuditActorType | None = None,
    action: str | None = None,
    study_id: uuid.UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    cursor: int | None = None,
    limit: int = 50,
) -> AuditPage:
    conditions = []
    if actor_type is not None:
        conditions.append(AuditLog.actor_type == actor_type)
    if action:
        conditions.append(AuditLog.action == action)
    if study_id is not None:
        conditions.append(
            or_(
                AuditLog.target == str(study_id),
                AuditLog.details.op("->>")("study_id") == str(study_id),
            )
        )
    if since is not None:
        conditions.append(AuditLog.at >= _as_utc(since))
    if until is not None:
        conditions.append(AuditLog.at <= _as_utc(until))
    if cursor is not None:
        conditions.append(AuditLog.id < cursor)

    rows = list(
        session.scalars(
            select(AuditLog).where(*conditions).order_by(AuditLog.id.desc()).limit(limit + 1)
        )
    )
    has_more = len(rows) > limit
    events = rows[:limit]
    return AuditPage(
        events=events,
        next_cursor=events[-1].id if has_more and events else None,
    )


def list_erasures(
    session: Session,
    *,
    cursor: int | None = None,
    limit: int = COMPLETED_ERASURES_LIMIT,
) -> ErasureListing:
    """Erasures scheduled from the app (read only) and the erasures already run.

    The completed list is paginated like :func:`list_audit`: ``cursor`` is the id of the last
    row of the previous page.
    """
    scheduled = list(
        session.scalars(
            select(Participant)
            .where(Participant.status == ParticipantStatus.ERASURE_SCHEDULED)
            .order_by(Participant.erasure_due_at.asc().nulls_last(), Participant.id)
        )
    )
    statement = select(AuditLog).where(AuditLog.action == ERASED_ACTION)
    if cursor is not None:
        statement = statement.where(AuditLog.id < cursor)
    rows = list(session.scalars(statement.order_by(AuditLog.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    completed = rows[:limit]
    return ErasureListing(
        scheduled=scheduled,
        completed=completed,
        next_cursor=completed[-1].id if has_more and completed else None,
    )


def study_titles(session: Session, study_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not study_ids:
        return {}
    return dict(session.execute(select(Study.id, Study.title).where(Study.id.in_(study_ids))).all())


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
