"""Joining with a code and the participant side of a participation."""

import json
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AccountParticipation,
    Activity,
    AuditLog,
    Availability,
    Consent,
    Entry,
    InviteCode,
    Participant,
    ParticipantAccount,
    Prompt,
    Study,
    StudyAnswer,
    StudyMember,
    StudyQuestion,
)
from app.models.enums import (
    AuditActorType,
    EntryType,
    InviteCodeKind,
    ParticipantStatus,
    PromptStatus,
    QuestionKind,
    StudyRole,
)
from app.security import codes
from app.services.participation import compute_device_hash

LOOKUP = "/api/v1/participation/invitations/lookup"
ACCEPT = "/api/v1/participation/invitations/accept"
ME = "/api/v1/participation/me"
APPROVAL = "/api/v1/participation/me/approval"
AVAILABILITY = "/api/v1/participation/me/availability"
PUSH_TOKEN = "/api/v1/participation/me/push-token"
PROMPTS = "/api/v1/participation/me/prompts"
ACTIVITIES = "/api/v1/participation/me/activities"
ACCOUNT_RECOVERY = "/api/v1/account/recovery"
ACCOUNT_CONFIRM = "/api/v1/account/confirm"
LEAVE = "/api/v1/participation/me/leave"
RETURN = "/api/v1/participation/me/return"
ERASURE = "/api/v1/participation/me/erasure"
ERASURE_CANCEL = "/api/v1/participation/me/erasure/cancel"

LISBON = ZoneInfo("Europe/Lisbon")


def _device(token: str) -> dict[str, str]:
    return {"Authorization": f"Device {token}"}


def _add_activity(
    session: Session,
    study: Study,
    *,
    title: str = "Diary",
    entry_types: list[str] | None = None,
    prompts_per_day: int = 2,
    expected_minutes: int = 5,
    capture_location: bool = True,
    allow_free_entries: bool = False,
    max_free_entries_per_day: int | None = None,
    options: dict[str, object] | None = None,
) -> Activity:
    activity = Activity(
        study_id=study.id,
        title=title,
        instructions="Record what happened.",
        entry_types=entry_types or ["text", "photo"],
        options=options,
        prompts_per_day=prompts_per_day,
        window_start=time(8),
        window_end=time(20),
        min_gap_minutes=60,
        capture_location=capture_location,
        allow_free_entries=allow_free_entries,
        max_free_entries_per_day=max_free_entries_per_day,
        expected_minutes=expected_minutes,
    )
    session.add(activity)
    session.commit()
    return activity


def _add_question(
    session: Session,
    study: Study,
    *,
    text: str = "How do you feel?",
    kind: QuestionKind = QuestionKind.SINGLE_CHOICE,
    options: list[str] | None = None,
    position: int = 0,
) -> StudyQuestion:
    question = StudyQuestion(
        study_id=study.id,
        position=position,
        kind=kind,
        text=text,
        options=options or [],
    )
    session.add(question)
    session.commit()
    return question


def _add_team_member(session: Session, study: Study, make_user) -> str:
    user = make_user(email="team@example.org")
    session.add(
        StudyMember(
            study_id=study.id,
            user_id=user.id,
            role=StudyRole.PRINCIPAL_INVESTIGATOR,
        )
    )
    session.commit()
    return user.email


def _personal_code(
    session: Session,
    participant: Participant,
    *,
    expired: bool = False,
    used: bool = False,
) -> tuple[str, InviteCode]:
    raw = codes.generate_personal_code()
    row = InviteCode(
        study_id=participant.study_id,
        kind=InviteCodeKind.PERSONAL,
        code_hash=codes.hash_code(raw),
        participant_id=participant.id,
        expires_at=datetime.now(UTC) + (-timedelta(days=1) if expired else timedelta(days=7)),
        used_at=datetime.now(UTC) if used else None,
        active=True,
        requires_approval=False,
        requires_account=False,
        uses=0,
    )
    session.add(row)
    session.commit()
    return raw, row


def _study_code(
    session: Session,
    study: Study,
    *,
    approval: bool = True,
    requires_account: bool = False,
    max_uses: int | None = None,
    max_per_hour: int | None = None,
    used: int = 0,
    active: bool = True,
    expired: bool = False,
) -> tuple[str, InviteCode]:
    raw = codes.generate_study_code()
    row = InviteCode(
        study_id=study.id,
        kind=InviteCodeKind.STUDY,
        code_value=raw,
        name="Poster",
        max_uses=max_uses,
        max_per_hour=max_per_hour,
        uses=used,
        expires_at=datetime.now(UTC) + (-timedelta(days=1) if expired else timedelta(days=7)),
        active=active,
        requires_approval=approval,
        requires_account=requires_account,
    )
    session.add(row)
    session.commit()
    return raw, row


def _accept(
    client: TestClient,
    code: str,
    *,
    android_id: str | None = None,
    locale: str = "pt",
    consent_version: str = "1.0",
    answers: list[dict[str, object]] | None = None,
    token: str | None = None,
    account_token: str | None = None,
):
    headers = _device(token) if token else {}
    if account_token is not None:
        headers = {"Authorization": f"Account {account_token}"}
    return client.post(
        ACCEPT,
        json={
            "code": code,
            "android_id": android_id,
            "locale": locale,
            "consent_version": consent_version,
            "answers": answers or [],
        },
        headers=headers,
    )


def _confirmed_account(client: TestClient) -> str:
    created = client.post(ACCOUNT_RECOVERY)
    assert created.status_code == 201
    token = created.json()["account_token"]
    confirmed = client.post(
        ACCOUNT_CONFIRM,
        json={"device_tokens": [], "pool_credential": None},
        headers={"Authorization": f"Account {token}"},
    )
    assert confirmed.status_code == 200, confirmed.text
    return token


def _participant_with_token(
    session: Session, make_participant, study: Study, token: str = "participant-token"
) -> Participant:
    participant = make_participant(study, device_token=token, alias="P-01")
    return participant


def _add_prompt(
    session: Session,
    participant: Participant,
    activity: Activity,
    *,
    status: PromptStatus,
    day: datetime | None = None,
    occurrence: int = 0,
) -> Prompt:
    plan_date = (day or datetime.now(LISBON)).date()
    prompt = Prompt(
        activity_id=activity.id,
        participant_id=participant.id,
        plan_date=plan_date,
        occurrence=occurrence,
        scheduled_at=datetime.now(UTC),
        sent_at=datetime.now(UTC) if status == PromptStatus.SENT else None,
        status=status,
    )
    session.add(prompt)
    session.commit()
    return prompt


def test_lookup_personal_code_returns_the_card_without_using_the_code(
    client: TestClient, session: Session, make_study, make_participant, make_user
) -> None:
    study = make_study(title="Daily life")
    participant = make_participant(study)
    activity = _add_activity(session, study)
    question = _add_question(session, study, text="Which mood?", options=["Calm", "Tired"])
    team_email = _add_team_member(session, study, make_user)
    raw, code = _personal_code(session, participant)

    response = client.post(LOOKUP, json={"code": raw.lower(), "android_id": "android-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["code_kind"] == "personal"
    assert body["requires_approval"] is False
    assert body["requires_account"] is False
    assert body["existing_participation"] is None
    assert body["consent_version"]
    assert body["study"]["title"] == "Daily life"
    assert body["study"]["team"] == [team_email]
    assert body["study"]["requests_per_day"] == activity.prompts_per_day
    assert body["study"]["expected_minutes_per_day"] == (
        activity.prompts_per_day * activity.expected_minutes
    )
    assert body["study"]["entry_types"] == ["photo", "text"]
    assert body["study"]["captures_location"] is True
    assert body["questions"] == [
        {
            "id": str(question.id),
            "position": 0,
            "kind": "single_choice",
            "text": "Which mood?",
            "options": ["Calm", "Tired"],
        }
    ]

    session.refresh(code)
    assert code.used_at is None
    assert code.uses == 0
    assert participant.device_hash is None


def test_lookup_rejects_used_expired_and_unavailable_codes(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study)
    used_code, _ = _personal_code(session, participant, used=True)
    expired_code, _ = _personal_code(session, participant, expired=True)
    off_code, _ = _study_code(session, study, active=False)
    ended_code, _ = _study_code(session, study, expired=True)
    full_code, _ = _study_code(session, study, max_uses=1, used=1)

    for raw in ("NOT-A-CODE", used_code, expired_code, off_code, ended_code, full_code):
        response = client.post(LOOKUP, json={"code": raw})
        assert response.status_code == 404, raw
        assert response.json()["error"]["code"] == "invalid_code"


def test_lookup_reports_an_existing_participation_and_stores_no_device_hash(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study)
    participant.device_hash = compute_device_hash(study, "android-1")
    session.commit()
    raw, code = _personal_code(session, participant)

    response = client.post(LOOKUP, json={"code": raw, "android_id": "android-1"})

    assert response.status_code == 200
    body = response.json()
    existing = body["existing_participation"]
    assert existing["status"] == "active"
    assert existing["can_erase"] is True
    assert existing["can_return"] is False
    session.refresh(code)
    assert code.used_at is None


def test_lookup_of_a_used_personal_code_answers_its_own_phone(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study)
    participant.device_hash = compute_device_hash(study, "android-1")
    session.commit()
    raw, _code = _personal_code(session, participant, used=True)

    same_phone = client.post(LOOKUP, json={"code": raw, "android_id": "android-1"})
    assert same_phone.status_code == 200
    assert same_phone.json()["existing_participation"]["status"] == "active"

    other_phone = client.post(LOOKUP, json={"code": raw, "android_id": "android-2"})
    assert other_phone.status_code == 404
    assert other_phone.json()["error"]["code"] == "invalid_code"


def test_the_same_android_id_gives_a_different_hash_in_each_study(make_study) -> None:
    first = make_study(title="One")
    second = make_study(title="Two")

    first_hash = compute_device_hash(first, "android-1")
    second_hash = compute_device_hash(second, "android-1")

    assert first_hash is not None and second_hash is not None
    assert first_hash != second_hash
    assert first_hash == compute_device_hash(first, "android-1")
    assert compute_device_hash(first, None) is None


def test_accept_personal_code_issues_a_token_once_and_stores_consent_and_answers(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, alias="P-01")
    question = _add_question(session, study, options=["Calm", "Tired"])
    multiple = _add_question(
        session,
        study,
        text="What did you do?",
        kind=QuestionKind.MULTIPLE_CHOICE,
        options=["Walk", "Read", "Rest"],
        position=1,
    )
    raw, code = _personal_code(session, participant)

    response = _accept(
        client,
        raw,
        android_id="android-1",
        locale="en",
        answers=[
            {"question_id": str(question.id), "answer": "Calm"},
            {"question_id": str(multiple.id), "answer": ["Walk", "Rest"]},
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "joined"
    assert body["token_type"] == "Device"
    token = body["device_token"]
    assert token
    assert body["participant"]["id"] == str(participant.id)
    assert body["participant"]["status"] == "active"
    assert body["participant"]["alias"] == "P-01"
    assert body["participant"]["locale"] == "en"
    assert body["participant"]["has_consent"] is True
    assert body["participant"]["study"]["title"] == study.title

    session.refresh(participant)
    assert participant.device_token_hash == codes.hash_device_token(token)
    assert participant.device_token_hash != token
    assert participant.device_hash == compute_device_hash(study, "android-1")
    session.refresh(code)
    assert code.used_at is not None

    consent = session.scalar(select(Consent).where(Consent.participant_id == participant.id))
    assert consent is not None and consent.version == "1.0"
    answers = {
        row.question_id: row
        for row in session.scalars(
            select(StudyAnswer).where(StudyAnswer.participant_id == participant.id)
        )
    }
    assert set(answers) == {question.id, multiple.id}
    assert answers[question.id].answer == "Calm"
    assert answers[question.id].question_text == "How do you feel?"
    assert answers[multiple.id].answer == json.dumps(["Walk", "Rest"])
    assert answers[multiple.id].kind == QuestionKind.MULTIPLE_CHOICE

    me = client.get(ME, headers=_device(token))
    assert me.status_code == 200
    assert me.json()["push_token_registered"] is False

    # A second attempt by the same phone is answered by the state of its row and does not use
    # the code again (FR-106); without a valid token it gets a fresh one and the old is revoked.
    again = _accept(client, raw, android_id="android-1")
    assert again.status_code == 200
    again_body = again.json()
    assert again_body["outcome"] == "already_participating"
    second_token = again_body["device_token"]
    assert second_token and second_token != token
    assert client.get(ME, headers=_device(token)).status_code == 401
    assert client.get(ME, headers=_device(second_token)).status_code == 200

    with_token = _accept(client, raw, android_id="android-1", token=second_token)
    assert with_token.status_code == 200
    assert with_token.json()["outcome"] == "already_participating"
    assert with_token.json()["device_token"] is None

    other_phone = _accept(client, raw, android_id="android-2")
    assert other_phone.status_code == 404
    assert other_phone.json()["error"]["code"] == "invalid_code"


def test_accept_rejects_answers_that_break_the_rules(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    participant = make_participant(study)
    choice = _add_question(session, study, options=["Calm", "Tired"])
    text = _add_question(
        session, study, text="Tell us more", kind=QuestionKind.SHORT_TEXT, position=1
    )
    multiple = _add_question(
        session,
        study,
        text="Pick many",
        kind=QuestionKind.MULTIPLE_CHOICE,
        options=["A", "B"],
        position=2,
    )
    foreign = _add_question(session, other_study, options=["X"])
    raw, code = _personal_code(session, participant)

    invalid_choice = _accept(
        client, raw, answers=[{"question_id": str(choice.id), "answer": "Angry"}]
    )
    too_long = _accept(client, raw, answers=[{"question_id": str(text.id), "answer": "x" * 301}])
    other_study_answer = _accept(
        client, raw, answers=[{"question_id": str(foreign.id), "answer": "X"}]
    )
    wrong_shape = _accept(client, raw, answers=[{"question_id": str(text.id), "answer": ["x"]}])
    multiple_as_text = _accept(
        client, raw, answers=[{"question_id": str(multiple.id), "answer": "A"}]
    )
    duplicate = _accept(
        client,
        raw,
        answers=[
            {"question_id": str(choice.id), "answer": "Calm"},
            {"question_id": str(choice.id), "answer": "Tired"},
        ],
    )

    for response in (
        invalid_choice,
        too_long,
        other_study_answer,
        wrong_shape,
        multiple_as_text,
        duplicate,
    ):
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_study_answer"

    session.refresh(code)
    assert code.used_at is None
    assert (
        session.scalar(select(StudyAnswer.id).where(StudyAnswer.participant_id == participant.id))
        is None
    )


def test_accept_study_code_with_approval_creates_a_pending_participant(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, approval=True)

    response = _accept(client, raw, android_id="android-1")

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "pending_approval"
    assert body["participant"]["status"] == "pending_approval"
    assert body["participant"]["alias"] is None
    token = body["device_token"]
    assert token
    session.refresh(code)
    assert code.uses == 1

    participant = session.scalar(select(Participant).where(Participant.study_id == study.id))
    assert participant is not None and participant.admitted_by_code_id == code.id
    assert participant.device_hash == compute_device_hash(study, "android-1")

    poll = client.get(APPROVAL, headers=_device(token))
    assert poll.status_code == 200
    assert poll.json()["status"] == "pending_approval"
    assert poll.json()["alias"] is None

    prompts = client.get(PROMPTS, headers=_device(token))
    assert prompts.status_code == 200
    assert prompts.json()["prompts"] == []

    audit = session.scalar(select(AuditLog).where(AuditLog.action == "study_code_entry"))
    assert audit is not None
    assert audit.actor_type == AuditActorType.PARTICIPANT
    assert audit.actor_id == participant.id
    assert audit.target == str(code.id)

    participant.status = ParticipantStatus.ACTIVE
    participant.alias = "P-01"
    participant.decided_at = datetime.now(UTC)
    session.commit()
    later = client.get(APPROVAL, headers=_device(token))
    assert later.json()["status"] == "active"
    assert later.json()["alias"] == "P-01"


def test_accept_study_code_without_approval_activates_and_assigns_an_alias(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, _code = _study_code(session, study, approval=False)

    response = _accept(client, raw, android_id="android-2")

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "joined"
    assert body["participant"]["status"] == "active"
    assert body["participant"]["alias"].startswith("P-")


def test_study_code_entry_limit_is_enforced_and_not_exceeded(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, max_uses=1, approval=False)

    first = _accept(client, raw, android_id="android-1")
    second = _accept(client, raw, android_id="android-2")

    assert first.status_code == 200
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "invalid_code"
    session.refresh(code)
    assert code.uses == 1
    assert (
        len(session.scalars(select(Participant).where(Participant.study_id == study.id)).all()) == 1
    )


def test_study_code_per_hour_limit_is_enforced(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, max_per_hour=1, approval=False)

    assert _accept(client, raw, android_id="android-1").status_code == 200
    blocked = _accept(client, raw, android_id="android-2")

    assert blocked.status_code == 404
    session.refresh(code)
    assert code.uses == 1


def test_study_code_second_entry_from_the_same_phone_answers_with_the_existing_row(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, approval=False)

    first = _accept(client, raw, android_id="android-1")
    token = first.json()["device_token"]

    with_token = _accept(client, raw, android_id="android-1", token=token)
    assert with_token.status_code == 200
    assert with_token.json()["outcome"] == "already_participating"
    assert with_token.json()["device_token"] is None
    assert with_token.json()["participant"]["id"] == first.json()["participant"]["id"]

    without_token = _accept(client, raw, android_id="android-1")
    assert without_token.status_code == 200
    assert without_token.json()["outcome"] == "already_participating"
    replacement = without_token.json()["device_token"]
    assert replacement and replacement != token
    assert client.get(ME, headers=_device(token)).status_code == 401
    assert client.get(ME, headers=_device(replacement)).status_code == 200

    session.refresh(code)
    assert code.uses == 1
    assert (
        len(session.scalars(select(Participant).where(Participant.study_id == study.id)).all()) == 1
    )


def test_withdrawn_participant_returns_to_the_same_pseudonym_with_a_new_token(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, device_token="old-token", alias="P-01")
    participant.device_hash = compute_device_hash(study, "android-1")
    participant.status = ParticipantStatus.WITHDRAWN
    session.commit()
    # The code is already full, but a person who is in the study is not affected by the limit.
    raw, code = _study_code(session, study, approval=False, max_uses=1, used=1)

    response = _accept(client, raw, android_id="android-1", token="old-token")

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "returned"
    assert body["participant"]["id"] == str(participant.id)
    assert body["participant"]["status"] == "active"
    assert body["device_token"] != "old-token"
    assert client.get(ME, headers=_device("old-token")).status_code == 401
    assert client.get(ME, headers=_device(body["device_token"])).status_code == 200
    session.refresh(code)
    assert code.uses == 1


def test_removed_erasure_scheduled_and_declined_participations_are_refused(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, approval=False)
    expected = {
        ParticipantStatus.REMOVED: "participation_removed",
        ParticipantStatus.ERASURE_SCHEDULED: "erasure_scheduled",
        ParticipantStatus.DECLINED: "entry_declined",
    }

    for index, (status, error_code) in enumerate(expected.items()):
        participant = make_participant(study, alias=f"P-{index + 1:02d}")
        participant.device_hash = compute_device_hash(study, f"android-{index}")
        participant.status = status
        session.commit()

        response = _accept(client, raw, android_id=f"android-{index}")

        assert response.status_code == 409
        assert response.json()["error"]["code"] == error_code
        session.refresh(code)
        assert code.uses == 0


def test_personal_code_for_another_phone_in_the_study_is_refused(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    pre_created = make_participant(study, alias="P-01")
    existing = make_participant(study, alias="P-02")
    existing.device_hash = compute_device_hash(study, "android-1")
    session.commit()
    raw, code = _personal_code(session, pre_created)

    response = _accept(client, raw, android_id="android-1")

    assert response.status_code == 200
    assert response.json()["outcome"] == "already_participating"
    assert response.json()["participant"]["id"] == str(existing.id)
    session.refresh(code)
    assert code.used_at is None


def test_study_code_that_requires_an_account_refuses_acceptance(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, requires_account=True)

    lookup = client.post(LOOKUP, json={"code": raw})
    assert lookup.status_code == 200
    assert lookup.json()["requires_account"] is True

    response = _accept(client, raw, android_id="android-1")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "account_required"
    session.refresh(code)
    assert code.uses == 0
    assert session.scalar(select(Participant).where(Participant.study_id == study.id)) is None


def test_account_required_code_accepts_a_signed_in_phone_and_links_it(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, requires_account=True, approval=False)
    account_token = _confirmed_account(client)

    response = _accept(client, raw, android_id="android-1", account_token=account_token)

    assert response.status_code == 200, response.text
    assert response.json()["outcome"] == "joined"
    participant = session.scalar(select(Participant).where(Participant.study_id == study.id))
    assert participant is not None
    account = session.scalar(select(ParticipantAccount))
    link = session.get(AccountParticipation, participant.id)
    assert link is not None
    assert link.account_id == account.id
    assert link.study_id == study.id
    session.refresh(code)
    assert code.uses == 1
    token = response.json()["device_token"]
    assert client.get(ME, headers=_device(token)).status_code == 200


def test_account_required_code_refuses_an_unconfirmed_account(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, code = _study_code(session, study, requires_account=True)
    created = client.post(ACCOUNT_RECOVERY)
    assert created.status_code == 201

    response = _accept(
        client,
        raw,
        android_id="android-1",
        account_token=created.json()["account_token"],
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "account_unconfirmed"
    session.refresh(code)
    assert code.uses == 0
    assert session.scalar(select(Participant).where(Participant.study_id == study.id)) is None


def test_accept_refuses_an_invalid_account_token(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, _code = _study_code(session, study, requires_account=True)

    response = _accept(client, raw, android_id="android-1", account_token="not-a-token")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_account_token"


def test_a_code_without_the_option_links_the_participation_when_signed_in(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    raw, _code = _study_code(session, study, requires_account=False, approval=False)
    account_token = _confirmed_account(client)

    response = _accept(client, raw, android_id="android-1", account_token=account_token)

    assert response.status_code == 200
    participant = session.scalar(select(Participant).where(Participant.study_id == study.id))
    assert participant is not None
    assert session.get(AccountParticipation, participant.id) is not None


def _add_entry(
    session: Session,
    participant: Participant,
    activity: Activity,
    recorded_at: datetime,
    *,
    prompt: Prompt | None = None,
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        activity_id=activity.id,
        prompt_id=prompt.id if prompt is not None else None,
        entry_type=EntryType.TEXT,
        content_sha256="a" * 64,
        recorded_at=recorded_at,
        body="A note",
    )
    session.add(entry)
    session.commit()
    return entry


def test_activities_return_what_the_app_needs_and_count_todays_free_entries(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "activities-token")
    scale = {"scale_type": "numbers", "points": 5, "start_label": "Low", "end_label": "High"}
    diary = _add_activity(
        session,
        study,
        title="Diary",
        entry_types=["text", "scale"],
        allow_free_entries=True,
        max_free_entries_per_day=2,
        options=scale,
    )
    closed = _add_activity(session, study, title="Poster", allow_free_entries=False)

    today = datetime.now(LISBON)
    _add_entry(session, participant, diary, today)
    _add_entry(session, participant, diary, today - timedelta(days=1))
    answered = _add_prompt(session, participant, diary, status=PromptStatus.ANSWERED)
    _add_entry(session, participant, diary, today, prompt=answered)

    response = client.get(ACTIVITIES, headers=_device("activities-token"))

    assert response.status_code == 200
    by_id = {row["id"]: row for row in response.json()}
    assert set(by_id) == {str(diary.id), str(closed.id)}
    row = by_id[str(diary.id)]
    assert row["title"] == "Diary"
    assert row["instructions"] == "Record what happened."
    assert row["entry_types"] == ["text", "scale"]
    assert row["options"] == scale
    assert row["capture_location"] is True
    assert row["allow_free_entries"] is True
    assert row["max_free_entries_per_day"] == 2
    assert row["free_entries_used_today"] == 1
    assert by_id[str(closed.id)]["allow_free_entries"] is False
    assert by_id[str(closed.id)]["max_free_entries_per_day"] is None
    assert by_id[str(closed.id)]["free_entries_used_today"] == 0


def test_activities_are_only_for_a_participant_that_can_record(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "withdrawn-token")
    _add_activity(session, study, allow_free_entries=True)
    participant.status = ParticipantStatus.WITHDRAWN
    session.commit()

    response = client.get(ACTIVITIES, headers=_device("withdrawn-token"))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "participant_not_active"


def test_get_me_returns_the_study_and_the_state(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study(title="Sleep")
    participant = _participant_with_token(session, make_participant, study, "me-token")

    response = client.get(ME, headers=_device("me-token"))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(participant.id)
    assert body["study"]["id"] == str(study.id)
    assert body["study"]["title"] == "Sleep"
    assert body["study"]["timezone"] == "Europe/Lisbon"
    assert body["status"] == "active"
    assert body["alias"] == "P-01"
    assert body["has_consent"] is False
    assert body["erasure_due_at"] is None


def test_availability_replaces_intervals_and_supports_any_time(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "avail-token")

    response = client.put(
        AVAILABILITY,
        headers=_device("avail-token"),
        json={
            "any_time": False,
            "intervals": [
                {"start_time": "08:00:00", "end_time": "12:00:00", "weekdays": [1, 2, 3]},
                {"start_time": "14:00:00", "end_time": "18:00:00", "weekdays": [4, 5]},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["any_time"] is False
    assert len(body["intervals"]) == 2
    rows = session.scalars(
        select(Availability).where(Availability.participant_id == participant.id)
    ).all()
    assert len(rows) == 2
    assert sorted(rows[0].weekdays) == [1, 2, 3]

    any_time = client.put(
        AVAILABILITY, headers=_device("avail-token"), json={"any_time": True, "intervals": []}
    )
    assert any_time.status_code == 200
    assert any_time.json() == {"any_time": True, "intervals": []}
    session.refresh(participant)
    assert participant.availability_any_time is True
    assert (
        session.scalars(
            select(Availability).where(Availability.participant_id == participant.id)
        ).all()
        == []
    )

    current = client.get(AVAILABILITY, headers=_device("avail-token"))
    assert current.json() == {"any_time": True, "intervals": []}

    bad_weekday = client.put(
        AVAILABILITY,
        headers=_device("avail-token"),
        json={
            "any_time": False,
            "intervals": [{"start_time": "08:00", "end_time": "09:00", "weekdays": [0]}],
        },
    )
    mixed = client.put(
        AVAILABILITY,
        headers=_device("avail-token"),
        json={
            "any_time": True,
            "intervals": [{"start_time": "08:00", "end_time": "09:00", "weekdays": [1]}],
        },
    )
    backwards = client.put(
        AVAILABILITY,
        headers=_device("avail-token"),
        json={
            "any_time": False,
            "intervals": [{"start_time": "09:00", "end_time": "08:00", "weekdays": [1]}],
        },
    )
    for invalid in (bad_weekday, mixed, backwards):
        assert invalid.status_code == 422


def test_push_token_registration_and_erasure_guard(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "push-token")

    registered = client.put(
        PUSH_TOKEN,
        headers=_device("push-token"),
        json={"push_token": "ExponentPushToken[abc]"},
    )
    assert registered.status_code == 204
    session.refresh(participant)
    assert participant.push_token == "ExponentPushToken[abc]"
    assert client.get(ME, headers=_device("push-token")).json()["push_token_registered"] is True

    cleared = client.put(PUSH_TOKEN, headers=_device("push-token"), json={"push_token": None})
    assert cleared.status_code == 204
    session.refresh(participant)
    assert participant.push_token is None

    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    session.commit()
    refused = client.put(PUSH_TOKEN, headers=_device("push-token"), json={"push_token": "x"})
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "invalid_state"


def test_open_prompts_lists_only_todays_sent_prompts_of_this_participant(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "prompt-token")
    other = make_participant(study, alias="P-02")
    activity = _add_activity(session, study)
    today = datetime.now(LISBON).date()

    sent = _add_prompt(session, participant, activity, status=PromptStatus.SENT)
    _add_prompt(session, participant, activity, status=PromptStatus.PLANNED, occurrence=1)
    _add_prompt(session, participant, activity, status=PromptStatus.ANSWERED, occurrence=2)
    _add_prompt(
        session,
        participant,
        activity,
        status=PromptStatus.SENT,
        day=datetime.now(UTC) - timedelta(days=1),
        occurrence=3,
    )
    _add_prompt(session, other, activity, status=PromptStatus.SENT)

    response = client.get(PROMPTS, headers=_device("prompt-token"))

    assert response.status_code == 200
    body = response.json()
    assert body["date"] == today.isoformat()
    assert [prompt["id"] for prompt in body["prompts"]] == [str(sent.id)]
    prompt = body["prompts"][0]
    assert prompt["title"] == "Diary"
    assert prompt["entry_types"] == ["text", "photo"]
    assert prompt["expected_minutes"] == 5
    assert prompt["capture_location"] is True
    assert prompt["status"] == "sent"
    assert prompt["closes_at"]

    participant.status = ParticipantStatus.WITHDRAWN
    session.commit()
    assert client.get(PROMPTS, headers=_device("prompt-token")).json()["prompts"] == []


def test_leave_deletes_planned_prompts_and_return_reactivates(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "leave-token")
    activity = _add_activity(session, study)
    planned = _add_prompt(session, participant, activity, status=PromptStatus.PLANNED)

    response = client.post(LEAVE, headers=_device("leave-token"))

    assert response.status_code == 200
    assert response.json()["status"] == "withdrawn"
    session.refresh(participant)
    assert participant.status == ParticipantStatus.WITHDRAWN
    assert session.get(Prompt, planned.id) is None

    returned = client.post(RETURN, headers=_device("leave-token"))
    assert returned.status_code == 200
    assert returned.json()["status"] == "active"


def test_leave_and_return_refuse_states_that_do_not_allow_it(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "state-token")

    participant.status = ParticipantStatus.PENDING_APPROVAL
    session.commit()
    assert client.post(LEAVE, headers=_device("state-token")).status_code == 409

    participant.status = ParticipantStatus.REMOVED
    session.commit()
    leave = client.post(LEAVE, headers=_device("state-token"))
    back = client.post(RETURN, headers=_device("state-token"))
    assert leave.status_code == 409
    assert back.status_code == 409
    assert back.json()["error"]["code"] == "participation_removed"


def test_erasure_request_and_cancel(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "erase-token")
    activity = _add_activity(session, study)
    planned = _add_prompt(session, participant, activity, status=PromptStatus.PLANNED)

    wrong_word = client.post(
        ERASURE, headers=_device("erase-token"), json={"confirmation": "maybe"}
    )
    assert wrong_word.status_code == 400
    assert wrong_word.json()["error"]["code"] == "confirmation_required"
    session.refresh(participant)
    assert participant.status == ParticipantStatus.ACTIVE

    response = client.post(ERASURE, headers=_device("erase-token"), json={"confirmation": "apagar"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "erasure_scheduled"
    assert body["status_before_erasure"] == "active"
    assert body["erasure_requested_at"] is not None
    due = datetime.fromisoformat(body["erasure_due_at"])
    assert timedelta(days=6, hours=23) < due - datetime.now(UTC) <= timedelta(days=7)
    session.refresh(participant)
    assert participant.status == ParticipantStatus.ERASURE_SCHEDULED
    assert participant.status_before_erasure == ParticipantStatus.ACTIVE
    assert session.get(Prompt, planned.id) is None

    audit = session.scalar(select(AuditLog).where(AuditLog.action == "erasure_requested"))
    assert audit is not None
    assert audit.actor_type == AuditActorType.PARTICIPANT
    assert audit.actor_id == participant.id

    readable = client.get(ME, headers=_device("erase-token"))
    assert readable.status_code == 200
    assert readable.json()["status"] == "erasure_scheduled"

    repeated = client.post(ERASURE, headers=_device("erase-token"), json={"confirmation": "APAGAR"})
    assert repeated.status_code == 409
    assert repeated.json()["error"]["code"] == "erasure_already_scheduled"

    cancelled = client.post(ERASURE_CANCEL, headers=_device("erase-token"))
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "active"
    assert cancelled.json()["erasure_due_at"] is None
    assert cancelled.json()["status_before_erasure"] is None
    session.refresh(participant)
    assert participant.status == ParticipantStatus.ACTIVE
    assert participant.erasure_requested_at is None

    audit = session.scalar(select(AuditLog).where(AuditLog.action == "erasure_cancelled"))
    assert audit is not None
    assert audit.actor_type == AuditActorType.PARTICIPANT

    again = client.post(ERASURE_CANCEL, headers=_device("erase-token"))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "no_erasure_scheduled"


def test_a_removed_participant_reads_the_state_and_can_still_erase(
    client: TestClient, session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = _participant_with_token(session, make_participant, study, "removed-token")
    participant.status = ParticipantStatus.REMOVED
    session.commit()

    readable = client.get(ME, headers=_device("removed-token"))
    assert readable.status_code == 200
    assert readable.json()["status"] == "removed"

    erased = client.post(ERASURE, headers=_device("removed-token"), json={"confirmation": "APAGAR"})
    assert erased.status_code == 200
    assert erased.json()["status"] == "erasure_scheduled"
    assert erased.json()["status_before_erasure"] == "removed"


def test_participant_routes_require_a_valid_device_token(client: TestClient) -> None:
    missing = client.get(ME)
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "not_authenticated"

    unknown = client.get(ME, headers=_device("unknown-token"))
    assert unknown.status_code == 401
    assert unknown.json()["error"]["code"] == "invalid_device_token"

    bearer = client.get(ME, headers={"Authorization": "Bearer a-token"})
    assert bearer.status_code == 401
    assert bearer.json()["error"]["code"] == "not_authenticated"

    assert client.post(LEAVE).status_code == 401
    assert client.post(ERASURE, json={"confirmation": "APAGAR"}).status_code == 401
