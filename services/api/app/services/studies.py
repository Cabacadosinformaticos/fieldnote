"""Business logic for studies, their team, questions and tags."""

import secrets
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    Consent,
    Entry,
    Participant,
    Prompt,
    Study,
    StudyMember,
    StudyQuestion,
    Tag,
    UserAccount,
)
from app.models.enums import (
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    StudyStatus,
    TodayFreeEntryDisplay,
    UserRole,
)
from app.schemas.studies import (
    StudyCreate,
    StudyQuestionCreate,
    StudyQuestionUpdate,
    StudyUpdate,
    validate_question,
)
from app.security.audit import record
from app.services.participation import CONSENT_VERSION

STUDY_NOT_FOUND = "The study does not exist."
STUDY_CLOSED = "A closed study cannot be changed."
NOT_A_MEMBER = "You do not have access to this study."


def get_study(session: Session, study_id: uuid.UUID) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", STUDY_NOT_FOUND)
    return study


def ensure_writable(study: Study) -> None:
    if study.status == StudyStatus.CLOSED:
        raise ApiError(409, "study_closed", STUDY_CLOSED)


# Prompt statuses that count towards adherence: a prompt that went out and was answered, is
# still waiting or expired. Planned prompts have not gone out yet (overview.py uses the same rule).
_ADHERENCE_STATUSES = frozenset({PromptStatus.ANSWERED, PromptStatus.SENT, PromptStatus.EXPIRED})
_RESEARCHER_VISIBLE_STATUSES = (
    ParticipantStatus.ACTIVE,
    ParticipantStatus.WITHDRAWN,
    ParticipantStatus.REMOVED,
)


@dataclass(frozen=True)
class StudyListRow:
    study: Study
    entry_count: int
    participant_count: int
    adherence_today: dict[str, object]
    adherence_study: dict[str, object]


def _adherence(counter: Counter) -> dict[str, object]:
    answered = counter.get(PromptStatus.ANSWERED, 0)
    out = sum(counter.get(status, 0) for status in _ADHERENCE_STATUSES)
    return {
        "answered": answered,
        "out": out,
        "percentage": round(answered * 100 / out, 1) if out else 0.0,
    }


def _today_in(timezone_name: str, now: datetime) -> date:
    try:
        timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        timezone = ZoneInfo("UTC")
    return now.astimezone(timezone).date()


def _adherence_counts(
    session: Session, studies: list[Study]
) -> tuple[dict[uuid.UUID, Counter], dict[uuid.UUID, Counter]]:
    """Two grouped queries for every study on the list, never one query per study."""
    study_ids = [study.id for study in studies]
    if not study_ids:
        return {}, {}
    now = datetime.now(UTC)
    today_by_study = {study.id: _today_in(study.timezone, now) for study in studies}
    today_dates = set(today_by_study.values())

    study_counts: dict[uuid.UUID, Counter] = defaultdict(Counter)
    for study_id, status, count in session.execute(
        select(Participant.study_id, Prompt.status, func.count())
        .join(Prompt, Prompt.participant_id == Participant.id)
        .where(
            Participant.study_id.in_(study_ids),
            Participant.status.in_(_RESEARCHER_VISIBLE_STATUSES),
            Prompt.status.in_(_ADHERENCE_STATUSES),
        )
        .group_by(Participant.study_id, Prompt.status)
    ).all():
        study_counts[study_id][status] += count

    today_counts: dict[uuid.UUID, Counter] = defaultdict(Counter)
    for study_id, plan_date, status, count in session.execute(
        select(Participant.study_id, Prompt.plan_date, Prompt.status, func.count())
        .join(Prompt, Prompt.participant_id == Participant.id)
        .where(
            Participant.study_id.in_(study_ids),
            Participant.status.in_(_RESEARCHER_VISIBLE_STATUSES),
            Prompt.status.in_(_ADHERENCE_STATUSES),
            Prompt.plan_date.in_(today_dates),
        )
        .group_by(Participant.study_id, Prompt.plan_date, Prompt.status)
    ).all():
        if plan_date == today_by_study.get(study_id):
            today_counts[study_id][status] += count
    return study_counts, today_counts


def list_studies(session: Session, user: UserAccount) -> list[StudyListRow]:
    """The studies the user may see, with entry, participant and adherence figures.

    The counts come from grouped subqueries joined in this one statement and the adherence from
    two grouped queries for all studies, so the list never issues a query per study.
    """
    entry_totals = (
        select(Participant.study_id, func.count(Entry.id).label("entry_count"))
        .join(Entry, Entry.participant_id == Participant.id)
        .group_by(Participant.study_id)
        .subquery()
    )
    participant_totals = (
        select(Participant.study_id, func.count(Participant.id).label("participant_count"))
        .where(Participant.status == ParticipantStatus.ACTIVE)
        .group_by(Participant.study_id)
        .subquery()
    )
    statement = (
        select(
            Study,
            func.coalesce(entry_totals.c.entry_count, 0),
            func.coalesce(participant_totals.c.participant_count, 0),
        )
        .outerjoin(entry_totals, entry_totals.c.study_id == Study.id)
        .outerjoin(participant_totals, participant_totals.c.study_id == Study.id)
        .order_by(Study.title)
    )
    if user.role != UserRole.ADMIN:
        statement = statement.join(StudyMember, StudyMember.study_id == Study.id).where(
            StudyMember.user_id == user.id
        )
    rows = session.execute(statement).all()
    study_counts, today_counts = _adherence_counts(session, [row[0] for row in rows])
    return [
        StudyListRow(
            study=study,
            entry_count=entry_count,
            participant_count=participant_count,
            adherence_today=_adherence(today_counts.get(study.id, Counter())),
            adherence_study=_adherence(study_counts.get(study.id, Counter())),
        )
        for study, entry_count, participant_count in rows
    ]


def _resolve_collaborators(session: Session, emails: list[str]) -> list[UserAccount]:
    """Resolve the collaborator emails of the creation form, keeping their order."""
    normalised = list(dict.fromkeys(email.strip().lower() for email in emails if email.strip()))
    if not normalised:
        return []
    users = list(
        session.scalars(select(UserAccount).where(func.lower(UserAccount.email).in_(normalised)))
    )
    by_email = {user.email.lower(): user for user in users}
    missing = [email for email in normalised if email not in by_email]
    if missing:
        raise ApiError(404, "user_not_found", f"No account uses the email address {missing[0]}.")
    for user in users:
        if user.role != UserRole.RESEARCHER:
            raise ApiError(409, "not_a_researcher", "Only researcher accounts can join a study.")
    return [by_email[email] for email in normalised]


def create_study(session: Session, user: UserAccount, payload: StudyCreate) -> Study:
    collaborators = _resolve_collaborators(session, payload.collaborators)
    study = Study(
        title=payload.title,
        description=payload.description,
        status=StudyStatus.DRAFT,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        timezone=payload.timezone,
        max_prompts_per_day=payload.max_prompts_per_day,
        max_prompts_per_slot=payload.max_prompts_per_slot,
        schedule_style=payload.schedule_style,
        today_free_entry_display=payload.today_free_entry_display or TodayFreeEntryDisplay.BOTH,
        device_salt=secrets.token_bytes(32),
        consent_text=payload.consent_text,
    )
    session.add(study)
    session.flush()
    session.add(
        StudyMember(
            study_id=study.id,
            user_id=user.id,
            role=StudyRole.PRINCIPAL_INVESTIGATOR,
        )
    )
    for collaborator in collaborators:
        if collaborator.id == user.id:
            continue
        session.add(StudyMember(study_id=study.id, user_id=collaborator.id, role=StudyRole.MEMBER))
        record(
            session,
            user,
            "study_member_added",
            target=str(collaborator.id),
            details={
                "study_id": str(study.id),
                "email": collaborator.email,
                "role": StudyRole.MEMBER.value,
            },
        )
    record(
        session,
        user,
        "study_created",
        target=str(study.id),
        details={"title": study.title},
    )
    session.commit()
    return study


def update_study(
    session: Session, user: UserAccount, study_id: uuid.UUID, payload: StudyUpdate
) -> Study:
    study = get_study(session, study_id)
    ensure_writable(study)

    merged = {
        "title": study.title,
        "description": study.description,
        "starts_on": study.starts_on,
        "ends_on": study.ends_on,
        "timezone": study.timezone,
        "max_prompts_per_day": study.max_prompts_per_day,
        "max_prompts_per_slot": study.max_prompts_per_slot,
        "schedule_style": study.schedule_style,
        "today_free_entry_display": study.today_free_entry_display,
        "consent_text": study.consent_text,
    }
    changes = payload.model_dump(exclude_unset=True)
    merged.update(changes)
    try:
        validated = StudyCreate.model_validate(merged)
    except ValidationError as exc:
        raise ApiError(422, "validation_error", "Request validation failed.") from exc

    if validated.today_free_entry_display is None:
        raise ApiError(422, "validation_error", "Request validation failed.")

    for field in merged:
        setattr(study, field, getattr(validated, field))
    record(
        session,
        user,
        "study_updated",
        target=str(study.id),
        details={"fields": sorted(changes)},
    )
    session.commit()
    return study


def start_study(session: Session, user: UserAccount, study_id: uuid.UUID) -> Study:
    study = get_study(session, study_id)
    if study.status != StudyStatus.DRAFT:
        raise ApiError(409, "invalid_status_transition", "Only a draft study can start.")
    study.status = StudyStatus.RUNNING
    record(session, user, "study_started", target=str(study.id))
    session.commit()
    return study


def close_study(session: Session, user: UserAccount, study_id: uuid.UUID) -> Study:
    study = get_study(session, study_id)
    if study.status != StudyStatus.RUNNING:
        raise ApiError(409, "invalid_status_transition", "Only a running study can be closed.")
    study.status = StudyStatus.CLOSED
    record(session, user, "study_closed", target=str(study.id))
    session.commit()
    return study


def list_members(session: Session, study_id: uuid.UUID) -> list[tuple[StudyMember, UserAccount]]:
    statement = (
        select(StudyMember, UserAccount)
        .join(UserAccount, UserAccount.id == StudyMember.user_id)
        .where(StudyMember.study_id == study_id)
        .order_by(UserAccount.email)
    )
    return list(session.execute(statement).all())


def _principal_count(session: Session, study_id: uuid.UUID) -> int:
    statement = (
        select(func.count())
        .select_from(StudyMember)
        .where(
            StudyMember.study_id == study_id,
            StudyMember.role == StudyRole.PRINCIPAL_INVESTIGATOR,
        )
    )
    return session.scalar(statement) or 0


def add_member(
    session: Session, actor: UserAccount, study_id: uuid.UUID, email: str, role: StudyRole
) -> tuple[StudyMember, UserAccount]:
    study = get_study(session, study_id)
    ensure_writable(study)

    normalised = email.strip().lower()
    target = session.scalar(select(UserAccount).where(func.lower(UserAccount.email) == normalised))
    if target is None:
        raise ApiError(404, "user_not_found", "No account uses that email address.")
    if target.role != UserRole.RESEARCHER:
        raise ApiError(409, "not_a_researcher", "Only researcher accounts can join a study.")
    if session.get(StudyMember, (study_id, target.id)) is not None:
        raise ApiError(409, "already_a_member", "That researcher is already in the study.")

    member = StudyMember(study_id=study_id, user_id=target.id, role=role)
    session.add(member)
    record(
        session,
        actor,
        "study_member_added",
        target=str(target.id),
        details={"study_id": str(study_id), "email": target.email, "role": role.value},
    )
    session.commit()
    return member, target


def _get_member(session: Session, study_id: uuid.UUID, user_id: uuid.UUID) -> StudyMember:
    member = session.get(StudyMember, (study_id, user_id))
    if member is None:
        raise ApiError(404, "study_member_not_found", "That researcher is not in the study.")
    return member


def change_member_role(
    session: Session, actor: UserAccount, study_id: uuid.UUID, user_id: uuid.UUID, role: StudyRole
) -> StudyMember:
    study = get_study(session, study_id)
    ensure_writable(study)
    member = _get_member(session, study_id, user_id)
    if (
        member.role == StudyRole.PRINCIPAL_INVESTIGATOR
        and role != StudyRole.PRINCIPAL_INVESTIGATOR
        and _principal_count(session, study_id) <= 1
    ):
        raise ApiError(
            409,
            "last_principal_investigator",
            "The study must keep at least one principal investigator.",
        )
    member.role = role
    record(
        session,
        actor,
        "study_member_role_changed",
        target=str(user_id),
        details={"study_id": str(study_id), "role": role.value},
    )
    session.commit()
    return member


def remove_member(
    session: Session, actor: UserAccount, study_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    study = get_study(session, study_id)
    ensure_writable(study)
    member = _get_member(session, study_id, user_id)
    if member.role == StudyRole.PRINCIPAL_INVESTIGATOR and _principal_count(session, study_id) <= 1:
        raise ApiError(
            409,
            "last_principal_investigator",
            "The study must keep at least one principal investigator.",
        )
    session.delete(member)
    record(
        session,
        actor,
        "study_member_removed",
        target=str(user_id),
        details={"study_id": str(study_id)},
    )
    session.commit()


def list_questions(session: Session, study_id: uuid.UUID) -> list[StudyQuestion]:
    statement = (
        select(StudyQuestion)
        .where(StudyQuestion.study_id == study_id)
        .order_by(StudyQuestion.position, StudyQuestion.id)
    )
    return list(session.scalars(statement).all())


def _get_question(session: Session, study_id: uuid.UUID, question_id: uuid.UUID) -> StudyQuestion:
    question = session.get(StudyQuestion, question_id)
    if question is None or question.study_id != study_id:
        raise ApiError(404, "study_question_not_found", "The study question does not exist.")
    return question


def create_question(
    session: Session, actor: UserAccount, study_id: uuid.UUID, payload: StudyQuestionCreate
) -> StudyQuestion:
    study = get_study(session, study_id)
    ensure_writable(study)
    last = session.scalar(
        select(func.max(StudyQuestion.position)).where(StudyQuestion.study_id == study_id)
    )
    question = StudyQuestion(
        study_id=study_id,
        position=(last or 0) + 1,
        kind=payload.kind,
        text=payload.text,
        options=payload.options,
    )
    session.add(question)
    session.flush()
    record(
        session,
        actor,
        "study_question_created",
        target=str(question.id),
        details={"study_id": str(study_id), "kind": payload.kind.value},
    )
    session.commit()
    return question


def update_question(
    session: Session,
    actor: UserAccount,
    study_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: StudyQuestionUpdate,
) -> StudyQuestion:
    study = get_study(session, study_id)
    ensure_writable(study)
    question = _get_question(session, study_id, question_id)

    changes = payload.model_dump(exclude_unset=True)
    kind = changes.get("kind", question.kind)
    text = changes.get("text", question.text)
    options = changes.get("options", question.options)
    try:
        text, options = validate_question(kind, text, options)
    except ValueError as exc:
        raise ApiError(422, "invalid_question", str(exc)) from exc

    question.kind = kind
    question.text = text
    question.options = options
    record(
        session,
        actor,
        "study_question_updated",
        target=str(question.id),
        details={"study_id": str(study_id), "fields": sorted(changes)},
    )
    session.commit()
    return question


def delete_question(
    session: Session, actor: UserAccount, study_id: uuid.UUID, question_id: uuid.UUID
) -> None:
    study = get_study(session, study_id)
    ensure_writable(study)
    question = _get_question(session, study_id, question_id)
    session.delete(question)
    record(
        session,
        actor,
        "study_question_deleted",
        target=str(question_id),
        details={"study_id": str(study_id)},
    )
    session.commit()


def reorder_questions(
    session: Session, actor: UserAccount, study_id: uuid.UUID, question_ids: list[uuid.UUID]
) -> list[StudyQuestion]:
    study = get_study(session, study_id)
    ensure_writable(study)
    questions = list_questions(session, study_id)
    existing = {question.id for question in questions}
    if len(set(question_ids)) != len(question_ids) or set(question_ids) != existing:
        raise ApiError(
            409,
            "question_order_mismatch",
            "The order must list every question of the study exactly once.",
        )

    by_id = {question.id: question for question in questions}
    for position, question_id in enumerate(question_ids, start=1):
        by_id[question_id].position = position
    record(
        session,
        actor,
        "study_questions_reordered",
        target=str(study_id),
        details={"order": [str(question_id) for question_id in question_ids]},
    )
    session.commit()
    return [by_id[question_id] for question_id in question_ids]


def consent_summary(session: Session, study_id: uuid.UUID) -> dict[str, object]:
    get_study(session, study_id)
    accepted = session.scalar(
        select(func.count(func.distinct(Consent.participant_id)))
        .join(Participant, Participant.id == Consent.participant_id)
        .where(
            Participant.study_id == study_id,
            Participant.status == ParticipantStatus.ACTIVE,
            Consent.version == CONSENT_VERSION,
        )
    )
    return {"version": CONSENT_VERSION, "accepted": accepted or 0}


def list_tags(session: Session, study_id: uuid.UUID) -> list[Tag]:
    statement = select(Tag).where(Tag.study_id == study_id).order_by(Tag.name, Tag.id)
    return list(session.scalars(statement).all())


def create_tag(session: Session, actor: UserAccount, study_id: uuid.UUID, name: str) -> Tag:
    get_study(session, study_id)
    tag = Tag(study_id=study_id, name=name)
    session.add(tag)
    session.flush()
    record(
        session,
        actor,
        "tag_created",
        target=str(tag.id),
        details={"study_id": str(study_id), "name": name},
    )
    session.commit()
    return tag


def delete_tag(
    session: Session, actor: UserAccount, study_id: uuid.UUID, tag_id: uuid.UUID
) -> None:
    tag = session.get(Tag, tag_id)
    if tag is None or tag.study_id != study_id:
        raise ApiError(404, "tag_not_found", "The tag does not exist.")
    session.delete(tag)
    record(
        session,
        actor,
        "tag_deleted",
        target=str(tag_id),
        details={"study_id": str(study_id)},
    )
    session.commit()
