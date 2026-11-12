"""Business logic for joining a study with a code and for a participant's participation.

The code lookup is deliberately read only: a code is consumed (personal) or counted (study)
only when the person accepts the card. The device check of FR-105 hashes the Android ID with the
study salt in memory and stores the result only on the participant row.
"""

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    Activity,
    Availability,
    Consent,
    InviteCode,
    Participant,
    ParticipantAccount,
    Prompt,
    Study,
    StudyAnswer,
    StudyMember,
    StudyQuestion,
    UserAccount,
)
from app.models.enums import (
    InviteCodeKind,
    Locale,
    ParticipantStatus,
    PromptStatus,
    QuestionKind,
    StudyStatus,
)
from app.security import codes
from app.security.audit import record
from app.services import account as account_service
from app.services.entries_upload import free_entries_used_today

CONSENT_VERSION = "1.0"
ERASURE_DELAY = timedelta(days=7)
# A phone clock can be off; a report outside this band is not believable and is clamped.
PROMPT_EVENT_TOLERANCE = timedelta(minutes=5)
MAX_ANSWER_LENGTH = 300
CONFIRMATION_WORDS = frozenset({"APAGAR", "ERASE"})

GENERIC_CODE_MESSAGE = "The invite code is invalid or no longer available."

_AVAILABILITY_STATUSES = frozenset(
    {ParticipantStatus.ACTIVE, ParticipantStatus.PENDING_APPROVAL, ParticipantStatus.WITHDRAWN}
)
_PUSH_STATUSES = frozenset(
    {
        ParticipantStatus.ACTIVE,
        ParticipantStatus.PENDING_APPROVAL,
        ParticipantStatus.WITHDRAWN,
        ParticipantStatus.REMOVED,
    }
)


@dataclass(frozen=True)
class InvitationLookup:
    code_kind: InviteCodeKind
    study: Study
    requires_approval: bool
    requires_account: bool
    questions: list[StudyQuestion]
    existing: Participant | None


@dataclass(frozen=True)
class Acceptance:
    outcome: str
    device_token: str | None
    participant: Participant


@dataclass(frozen=True)
class OpenPrompt:
    prompt: Prompt
    activity: Activity
    closes_at: datetime


@dataclass(frozen=True)
class FreeEntryActivity:
    activity: Activity
    used_today: int


@dataclass(frozen=True)
class PreparedAnswer:
    question: StudyQuestion
    answer: str


def _invalid_code() -> ApiError:
    return ApiError(404, "invalid_code", GENERIC_CODE_MESSAGE)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def study_timezone(study: Study) -> ZoneInfo:
    try:
        return ZoneInfo(study.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def compute_device_hash(study: Study, android_id: str | None) -> str | None:
    """HMAC-SHA256 of the Android ID under the salt of this study (FR-105)."""
    if not android_id or not android_id.strip():
        return None
    return hmac.new(
        study.device_salt, android_id.strip().encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _find_code(session: Session, canonical: str) -> InviteCode | None:
    if codes.is_personal_code(canonical):
        digest = codes.hash_code(canonical)
        row = session.scalar(
            select(InviteCode).where(
                InviteCode.kind == InviteCodeKind.PERSONAL,
                InviteCode.code_hash == digest,
            )
        )
        if row is None or row.code_hash is None or not codes.same_hash(row.code_hash, digest):
            return None
        return row

    row = session.scalar(
        select(InviteCode).where(
            InviteCode.kind == InviteCodeKind.STUDY,
            InviteCode.code_value == canonical,
        )
    )
    if row is None or row.code_value is None or not codes.same_hash(row.code_value, canonical):
        return None
    return row


def _load_code(session: Session, raw: str) -> tuple[InviteCode, Study]:
    canonical = codes.normalize_code(raw)
    if canonical is None:
        raise _invalid_code()
    row = _find_code(session, canonical)
    if row is None:
        raise _invalid_code()
    study = session.get(Study, row.study_id)
    if study is None:
        raise _invalid_code()
    return row, study


def _check_code_available(
    session: Session,
    code: InviteCode,
    study: Study,
    now: datetime,
    *,
    check_limits: bool,
    check_per_hour: bool = False,
) -> None:
    """Check a code for a new entry.

    A switched-off code is always refused. The end date, the limits and the single use are
    skipped when an existing participation was found, because FR-90 says people already in the
    study are not affected by them and FR-106 answers by the state of their row.
    """
    if not code.active:
        raise _invalid_code()
    if not check_limits:
        return
    if code.kind == InviteCodeKind.PERSONAL:
        if (
            code.used_at is not None
            or code.participant_id is None
            or _aware(code.expires_at) <= now
        ):
            raise _invalid_code()
        return
    if _aware(code.expires_at) <= now:
        raise _invalid_code()
    if code.max_uses is not None and (code.uses or 0) >= code.max_uses:
        raise _invalid_code()
    if check_per_hour and code.max_per_hour is not None:
        cutoff = now - timedelta(hours=1)
        count = session.scalar(
            select(func.count())
            .select_from(Participant)
            .where(
                Participant.admitted_by_code_id == code.id,
                Participant.entered_at.is_not(None),
                Participant.entered_at >= cutoff,
            )
        )
        if (count or 0) >= code.max_per_hour:
            raise _invalid_code()


def _match_device(session: Session, study_id: uuid.UUID, digest: str | None) -> Participant | None:
    if digest is None:
        return None
    participant = session.scalar(
        select(Participant).where(
            Participant.study_id == study_id, Participant.device_hash == digest
        )
    )
    if participant is None or participant.device_hash is None:
        return None
    return participant if codes.same_hash(participant.device_hash, digest) else None


def _next_alias(session: Session, study_id: uuid.UUID) -> str:
    """Aliases share the ``P-01`` form used when the team approves an entry."""
    aliases = {
        alias
        for alias in session.scalars(
            select(Participant.alias).where(
                Participant.study_id == study_id, Participant.alias.is_not(None)
            )
        )
        if alias is not None
    }
    number = 1
    while f"P-{number:02d}" in aliases:
        number += 1
    return f"P-{number:02d}"


def _prepare_answers(
    session: Session, study: Study, answers: list[tuple[uuid.UUID, str | list[str]]]
) -> list[PreparedAnswer]:
    """Validate the answers of FR-109/FR-112 and keep them as the question was shown."""
    if not answers:
        return []

    ids = [question_id for question_id, _answer in answers]
    if len(set(ids)) != len(ids):
        raise ApiError(422, "invalid_study_answer", "A question is answered more than once.")

    questions = {
        question.id: question
        for question in session.scalars(
            select(StudyQuestion).where(
                StudyQuestion.study_id == study.id, StudyQuestion.id.in_(ids)
            )
        )
    }
    prepared: list[PreparedAnswer] = []
    for question_id, raw in answers:
        question = questions.get(question_id)
        if question is None:
            raise ApiError(
                422, "invalid_study_answer", "The answer refers to a question of another study."
            )
        if question.kind == QuestionKind.MULTIPLE_CHOICE:
            if not isinstance(raw, list):
                raise ApiError(422, "invalid_study_answer", "The answer has the wrong shape.")
            if not raw:
                continue
            chosen = list(dict.fromkeys(raw))
            if len(chosen) != len(raw) or any(option not in question.options for option in chosen):
                raise ApiError(
                    422, "invalid_study_answer", "The answer is not one of the options shown."
                )
            prepared.append(PreparedAnswer(question, json.dumps(chosen, ensure_ascii=False)))
            continue
        if not isinstance(raw, str):
            raise ApiError(422, "invalid_study_answer", "The answer has the wrong shape.")
        text = raw.strip()
        if not text:
            continue
        if question.kind == QuestionKind.SINGLE_CHOICE:
            if text not in question.options:
                raise ApiError(
                    422, "invalid_study_answer", "The answer is not one of the options shown."
                )
        elif question.kind == QuestionKind.YES_NO:
            text = text.lower()
            if text not in {"yes", "no"}:
                raise ApiError(422, "invalid_study_answer", "A yes or no question takes yes or no.")
        elif len(text) > MAX_ANSWER_LENGTH:
            raise ApiError(
                422,
                "invalid_study_answer",
                f"A short text answer has at most {MAX_ANSWER_LENGTH} characters.",
            )
        prepared.append(PreparedAnswer(question, text))
    return prepared


def _store_answers(
    session: Session, participant: Participant, prepared: list[PreparedAnswer], now: datetime
) -> None:
    for item in prepared:
        existing = session.scalar(
            select(StudyAnswer).where(
                StudyAnswer.participant_id == participant.id,
                StudyAnswer.question_id == item.question.id,
            )
        )
        if existing is None:
            session.add(
                StudyAnswer(
                    participant_id=participant.id,
                    question_id=item.question.id,
                    question_text=item.question.text,
                    kind=item.question.kind,
                    answer=item.answer,
                    answered_at=now,
                )
            )
        else:
            existing.question_text = item.question.text
            existing.kind = item.question.kind
            existing.answer = item.answer
            existing.answered_at = now


def _add_consent(session: Session, participant: Participant, version: str, now: datetime) -> None:
    session.add(Consent(participant_id=participant.id, version=version, accepted_at=now))


def _rotate_token(participant: Participant) -> str:
    raw = codes.generate_device_token()
    participant.device_token_hash = codes.hash_device_token(raw)
    return raw


def _token_matches(participant: Participant, raw: str | None) -> bool:
    if not raw or participant.device_token_hash is None:
        return False
    return hmac.compare_digest(participant.device_token_hash, codes.hash_device_token(raw))


def _resume_participation(
    session: Session,
    participant: Participant,
    digest: str | None,
    presented_token: str | None,
    locale: Locale,
) -> Acceptance:
    """Answer by the state of the matched row, without creating a row or using the code up."""
    if participant.status == ParticipantStatus.REMOVED:
        raise ApiError(
            409,
            "participation_removed",
            "The team removed this participation, which cannot be joined again.",
        )
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(
            409,
            "erasure_scheduled",
            "An erasure of this participation is scheduled; it can be cancelled in the app.",
        )
    if participant.status == ParticipantStatus.DECLINED:
        raise ApiError(409, "entry_declined", "The entry in this study was not accepted.")

    participant.locale = locale
    if participant.device_hash is None and digest is not None:
        participant.device_hash = digest

    if participant.status == ParticipantStatus.WITHDRAWN:
        participant.status = ParticipantStatus.ACTIVE
        raw = _rotate_token(participant)
        session.commit()
        return Acceptance("returned", raw, participant)

    if participant.status == ParticipantStatus.PENDING_APPROVAL:
        raw = None if _token_matches(participant, presented_token) else _rotate_token(participant)
        session.commit()
        return Acceptance("waiting_approval", raw, participant)

    raw = None if _token_matches(participant, presented_token) else _rotate_token(participant)
    session.commit()
    return Acceptance("already_participating", raw, participant)


def lookup_invitation(session: Session, raw_code: str, android_id: str | None) -> InvitationLookup:
    code, study = _load_code(session, raw_code)
    now = datetime.now(UTC)
    digest = compute_device_hash(study, android_id)
    _check_code_available(session, code, study, now, check_limits=False)
    existing = _match_device(session, study.id, digest)
    if existing is None:
        _check_code_available(session, code, study, now, check_limits=True)
    questions = list(
        session.scalars(
            select(StudyQuestion)
            .where(StudyQuestion.study_id == study.id)
            .order_by(StudyQuestion.position, StudyQuestion.id)
        )
    )
    return InvitationLookup(
        code_kind=code.kind,
        study=study,
        requires_approval=bool(code.requires_approval),
        requires_account=bool(code.requires_account),
        questions=questions,
        existing=existing,
    )


def _require_confirmed_account(account: ParticipantAccount | None) -> None:
    if account is not None and account.confirmed_at is None:
        raise ApiError(
            409,
            "account_unconfirmed",
            "Confirm that the recovery code was saved before joining with an account.",
        )


def _link_account(session: Session, account: ParticipantAccount | None, device_token: str) -> None:
    """Link before the single commit, so a link failure cannot leave a joined-unlinked row."""
    if account is not None:
        account_service.link_in_session(session, account, [device_token])


def accept_invitation(
    session: Session,
    *,
    raw_code: str,
    android_id: str | None,
    locale: Locale,
    consent_version: str,
    answers: list[tuple[uuid.UUID, str | list[str]]],
    presented_token: str | None,
    account: ParticipantAccount | None = None,
) -> Acceptance:
    canonical = codes.normalize_code(raw_code)
    if canonical is None:
        raise _invalid_code()
    preliminary = _find_code(session, canonical)
    if preliminary is None:
        raise _invalid_code()

    # Locking the study serialises entries and keeps the study code counter exact. The code row
    # is locked after it, so parallel accepts cannot pass the limit.
    study = session.scalar(select(Study).where(Study.id == preliminary.study_id).with_for_update())
    if study is None:
        raise _invalid_code()
    if study.status == StudyStatus.CLOSED:
        raise ApiError(409, "study_closed", "The study is closed and no longer accepts entries.")
    code = session.scalar(
        select(InviteCode).where(InviteCode.id == preliminary.id).with_for_update()
    )
    if code is None:
        raise _invalid_code()

    now = datetime.now(UTC)
    digest = compute_device_hash(study, android_id)

    if code.kind == InviteCodeKind.PERSONAL:
        _check_code_available(session, code, study, now, check_limits=False)

        # Any route answers a phone that is already in the study by the state of its row (FR-106).
        matched = _match_device(session, study.id, digest)
        if matched is not None:
            return _resume_participation(session, matched, digest, presented_token, locale)

        _check_code_available(session, code, study, now, check_limits=True)
        if code.participant_id is None:
            raise _invalid_code()
        participant = session.scalar(
            select(Participant).where(Participant.id == code.participant_id).with_for_update()
        )
        if participant is None:
            raise _invalid_code()

        if participant.status == ParticipantStatus.REMOVED:
            raise ApiError(409, "participation_removed", "The team removed this participation.")
        if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
            raise ApiError(
                409,
                "erasure_scheduled",
                "An erasure of this participation is scheduled; cancel it in the app first.",
            )
        if participant.status == ParticipantStatus.DECLINED:
            raise ApiError(409, "entry_declined", "The entry in this study was not accepted.")

        _require_confirmed_account(account)
        prepared = _prepare_answers(session, study, answers)
        raw = _rotate_token(participant)
        participant.device_hash = digest
        participant.locale = locale
        if participant.entered_at is None:
            participant.entered_at = now
        if participant.status == ParticipantStatus.WITHDRAWN:
            participant.status = ParticipantStatus.ACTIVE
        code.used_at = now
        _add_consent(session, participant, consent_version, now)
        _store_answers(session, participant, prepared, now)
        _link_account(session, account, raw)
        session.commit()
        return Acceptance("joined", raw, participant)

    # Only a switched-off code is refused before the device check: a person already in the study
    # is not affected by the end date or the limits (FR-90).
    _check_code_available(session, code, study, now, check_limits=False)
    matched = _match_device(session, study.id, digest)
    if matched is not None:
        return _resume_participation(session, matched, digest, presented_token, locale)

    _check_code_available(session, code, study, now, check_limits=True, check_per_hour=True)
    if code.requires_account and account is None:
        raise ApiError(
            409,
            "account_required",
            "This study code requires a participant account.",
        )
    _require_confirmed_account(account)

    prepared = _prepare_answers(session, study, answers)
    pending = bool(code.requires_approval)
    status = ParticipantStatus.PENDING_APPROVAL if pending else ParticipantStatus.ACTIVE
    raw = codes.generate_device_token()
    participant = Participant(
        study_id=study.id,
        alias=None if pending else _next_alias(session, study.id),
        admitted_by_code_id=code.id,
        device_token_hash=codes.hash_device_token(raw),
        device_hash=digest,
        entered_at=now,
        locale=locale,
        status=status,
    )
    session.add(participant)
    session.flush()
    code.uses = (code.uses or 0) + 1
    _add_consent(session, participant, consent_version, now)
    _store_answers(session, participant, prepared, now)
    record(
        session,
        participant,
        "study_code_entry",
        target=str(code.id),
        details={"study_id": str(study.id)},
    )
    _link_account(session, account, raw)
    session.commit()
    return Acceptance("pending_approval" if pending else "joined", raw, participant)


def get_study(session: Session, participant: Participant) -> Study:
    study = session.get(Study, participant.study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")
    return study


def has_consent(session: Session, participant: Participant) -> bool:
    return (
        session.scalar(select(Consent.id).where(Consent.participant_id == participant.id).limit(1))
        is not None
    )


def _ensure_status(participant: Participant, allowed: frozenset[ParticipantStatus]) -> None:
    if participant.status not in allowed:
        raise ApiError(
            409,
            "invalid_state",
            "The participation is not in a state that allows this action.",
        )


def set_availability(
    session: Session,
    participant: Participant,
    any_time: bool,
    intervals: list[tuple[time, time, list[int]]],
) -> list[Availability]:
    _ensure_status(participant, _AVAILABILITY_STATUSES)
    participant.availability_any_time = any_time
    session.execute(delete(Availability).where(Availability.participant_id == participant.id))
    rows: list[Availability] = []
    if not any_time:
        for start_time, end_time, weekdays in intervals:
            row = Availability(
                participant_id=participant.id,
                start_time=start_time,
                end_time=end_time,
                weekdays=weekdays,
            )
            session.add(row)
            rows.append(row)
    session.commit()
    return rows


def list_availability(session: Session, participant: Participant) -> list[Availability]:
    return list(
        session.scalars(
            select(Availability)
            .where(Availability.participant_id == participant.id)
            .order_by(Availability.start_time, Availability.end_time, Availability.id)
        )
    )


def register_push_token(session: Session, participant: Participant, push_token: str | None) -> None:
    _ensure_status(participant, _PUSH_STATUSES)
    token = push_token.strip() if push_token else None
    participant.push_token = token or None
    session.commit()


def leave_study(session: Session, participant: Participant) -> Participant:
    _ensure_status(participant, frozenset({ParticipantStatus.ACTIVE}))
    participant.status = ParticipantStatus.WITHDRAWN
    session.execute(
        delete(Prompt).where(
            Prompt.participant_id == participant.id,
            Prompt.status == PromptStatus.PLANNED,
        )
    )
    session.commit()
    return participant


def return_to_study(session: Session, participant: Participant) -> Participant:
    if participant.status == ParticipantStatus.REMOVED:
        raise ApiError(
            409,
            "participation_removed",
            "The team removed this participation, which cannot be joined again.",
        )
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(
            409,
            "erasure_scheduled",
            "An erasure is scheduled; cancel it before returning.",
        )
    _ensure_status(participant, frozenset({ParticipantStatus.WITHDRAWN}))
    participant.status = ParticipantStatus.ACTIVE
    session.commit()
    return participant


def request_erasure(session: Session, participant: Participant, confirmation: str) -> Participant:
    if participant.status == ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(409, "erasure_already_scheduled", "An erasure is already scheduled.")
    if confirmation.strip().upper() not in CONFIRMATION_WORDS:
        raise ApiError(
            400, "confirmation_required", "Type the confirmation word to erase the data."
        )
    now = datetime.now(UTC)
    due = now + ERASURE_DELAY
    participant.status_before_erasure = participant.status
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_requested_at = now
    participant.erasure_due_at = due
    session.execute(
        delete(Prompt).where(
            Prompt.participant_id == participant.id,
            Prompt.status == PromptStatus.PLANNED,
        )
    )
    record(
        session,
        participant,
        "erasure_requested",
        target=str(participant.id),
        details={"due_at": due.isoformat()},
    )
    session.commit()
    return participant


def cancel_erasure(session: Session, participant: Participant) -> Participant:
    if participant.status != ParticipantStatus.ERASURE_SCHEDULED:
        raise ApiError(409, "no_erasure_scheduled", "No erasure is scheduled.")
    participant.status = participant.status_before_erasure or ParticipantStatus.ACTIVE
    participant.erasure_requested_at = None
    participant.erasure_due_at = None
    participant.status_before_erasure = None
    record(session, participant, "erasure_cancelled", target=str(participant.id))
    session.commit()
    return participant


def _plausible_event_time(value: datetime, sent_at: datetime | None, now: datetime) -> datetime:
    """Keep a phone timestamp inside the window where it can be believed.

    Clamping beats refusing: a clock a few minutes off must not lose the whole report, and the
    app only sends the first value of each field, so a refused report could never be resent
    with a better time. A future value is clamped to the server clock and a value from well
    before the prompt was sent is clamped to ``sent_at``.
    """
    if value > now + PROMPT_EVENT_TOLERANCE:
        value = now
    if sent_at is not None and value < sent_at - PROMPT_EVENT_TOLERANCE:
        value = sent_at
    return value


def report_prompt_events(
    session: Session,
    participant: Participant,
    prompt_id: uuid.UUID,
    *,
    shown_at: datetime | None,
    opened_at: datetime | None,
) -> None:
    """Store the first shown and opened times of a prompt of this participant (FR-19)."""
    prompt = session.scalar(
        select(Prompt).where(
            Prompt.id == prompt_id,
            Prompt.participant_id == participant.id,
        )
    )
    if prompt is None:
        # Same answer as a prompt of another study: the device learns nothing about it.
        raise ApiError(404, "prompt_not_found", "The prompt does not exist.")

    now = datetime.now(UTC)
    events = {"shown_at": shown_at, "opened_at": opened_at}
    for column, value in events.items():
        if value is None:
            continue
        # The condition makes the first report win even when two resends race.
        session.execute(
            update(Prompt)
            .where(Prompt.id == prompt.id, getattr(Prompt, column).is_(None))
            .values({column: _plausible_event_time(value, prompt.sent_at, now)})
        )
    session.commit()


def open_prompts(session: Session, participant: Participant) -> tuple[date, list[OpenPrompt]]:
    study = get_study(session, participant)
    zone = study_timezone(study)
    today = datetime.now(zone).date()
    if participant.status != ParticipantStatus.ACTIVE:
        return today, []
    rows = session.execute(
        select(Prompt, Activity)
        .join(Activity, Prompt.activity_id == Activity.id)
        .where(
            Prompt.participant_id == participant.id,
            Prompt.plan_date == today,
            Prompt.status == PromptStatus.SENT,
        )
        .order_by(Prompt.scheduled_at, Prompt.occurrence)
    ).all()
    return today, [
        OpenPrompt(
            prompt=prompt,
            activity=activity,
            closes_at=datetime.combine(today, activity.window_end, tzinfo=zone),
        )
        for prompt, activity in rows
    ]


def free_entry_activities(session: Session, participant: Participant) -> list[FreeEntryActivity]:
    """The activities of the study with what is left of each daily free-entry cap (FR-13)."""
    if participant.status != ParticipantStatus.ACTIVE:
        raise ApiError(
            403,
            "participant_not_active",
            "Only an active participant can record entries.",
        )
    now = datetime.now(UTC)
    activities = session.scalars(
        select(Activity)
        .where(Activity.study_id == participant.study_id)
        .order_by(Activity.title, Activity.id)
    )
    return [
        FreeEntryActivity(
            activity=activity,
            used_today=free_entries_used_today(session, participant, activity, now),
        )
        for activity in activities
    ]


def study_card(session: Session, study: Study) -> dict[str, object]:
    team = [
        {"name": name, "email": email}
        for name, email in session.execute(
            select(UserAccount.name, UserAccount.email)
            .join(StudyMember, StudyMember.user_id == UserAccount.id)
            .where(StudyMember.study_id == study.id)
            .order_by(UserAccount.email)
        )
    ]
    activities = list(session.scalars(select(Activity).where(Activity.study_id == study.id)))
    entry_types = sorted(
        {entry_type for activity in activities for entry_type in activity.entry_types}
    )
    return {
        "id": study.id,
        "title": study.title,
        "description": study.description,
        "consent_text": study.consent_text,
        "status": study.status,
        "starts_on": study.starts_on,
        "ends_on": study.ends_on,
        "timezone": study.timezone,
        "team": team,
        "requests_per_day": sum(activity.prompts_per_day for activity in activities),
        "expected_minutes_per_day": sum(
            activity.prompts_per_day * activity.expected_minutes for activity in activities
        ),
        "entry_types": entry_types,
        "captures_location": any(activity.capture_location for activity in activities),
    }
