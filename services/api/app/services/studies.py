"""Business logic for studies, their team, questions and tags."""

import secrets
import uuid

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Consent, Participant, Study, StudyMember, StudyQuestion, Tag, UserAccount
from app.models.enums import ParticipantStatus, StudyRole, StudyStatus, UserRole
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


def list_studies(session: Session, user: UserAccount) -> list[Study]:
    statement = select(Study).order_by(Study.title)
    if user.role != UserRole.ADMIN:
        statement = statement.join(StudyMember, StudyMember.study_id == Study.id).where(
            StudyMember.user_id == user.id
        )
    return list(session.scalars(statement).all())


def create_study(session: Session, user: UserAccount, payload: StudyCreate) -> Study:
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
        device_salt=secrets.token_bytes(32),
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
    }
    changes = payload.model_dump(exclude_unset=True)
    merged.update(changes)
    try:
        validated = StudyCreate.model_validate(merged)
    except ValidationError as exc:
        raise ApiError(422, "validation_error", "Request validation failed.") from exc

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
