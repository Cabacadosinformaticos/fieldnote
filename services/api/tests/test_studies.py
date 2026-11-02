import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    AuditLog,
    Entry,
    Prompt,
    Study,
    StudyMember,
    StudyQuestion,
    Tag,
    UserAccount,
)
from app.models.enums import (
    EntryType,
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    StudyStatus,
    UserRole,
)

STUDIES = "/api/v1/studies"


def _payload(**overrides):
    payload = {
        "title": "Urban walks",
        "description": "A diary study of daily walks.",
        "timezone": "Europe/Lisbon",
        "max_prompts_per_day": 4,
        "max_prompts_per_slot": 2,
        "schedule_style": "balanced",
    }
    payload.update(overrides)
    return payload


def _add_member(session: Session, study_id, user: UserAccount, role: StudyRole) -> None:
    session.add(StudyMember(study_id=study_id, user_id=user.id, role=role))
    session.commit()


@pytest.fixture
def principal(make_user) -> UserAccount:
    return make_user(email="principal@example.org")


@pytest.fixture
def study(session: Session, make_study, principal: UserAccount) -> Study:
    study = make_study(title="Urban walks")
    _add_member(session, study.id, principal, StudyRole.PRINCIPAL_INVESTIGATOR)
    return study


def test_create_study_makes_the_creator_principal_investigator(
    client: TestClient, session: Session, make_user, bearer_headers
) -> None:
    user = make_user(email="creator@example.org")

    response = client.post(STUDIES, headers=bearer_headers(user), json=_payload())

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Urban walks"
    assert body["status"] == "draft"
    assert body["schedule_style"] == "balanced"
    assert body["timezone"] == "Europe/Lisbon"
    assert "device_salt" not in body

    study = session.get(Study, uuid.UUID(body["id"]))
    assert study is not None
    assert len(study.device_salt) == 32
    member = session.get(StudyMember, (study.id, user.id))
    assert member is not None
    assert member.role == StudyRole.PRINCIPAL_INVESTIGATOR

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "study_created")).one()
    assert audit.actor_id == user.id
    assert audit.target == str(study.id)


def test_create_study_requires_authentication(client: TestClient) -> None:
    assert client.post(STUDIES, json=_payload()).status_code == 401


def test_create_study_validates_the_timezone_and_the_dates(
    client: TestClient, make_user, bearer_headers
) -> None:
    user = make_user()

    bad_timezone = client.post(
        STUDIES, headers=bearer_headers(user), json=_payload(timezone="Mars/Olympus")
    )
    assert bad_timezone.status_code == 422
    assert bad_timezone.json()["error"]["code"] == "validation_error"

    bad_dates = client.post(
        STUDIES,
        headers=bearer_headers(user),
        json=_payload(starts_on="2026-11-10", ends_on="2026-11-01"),
    )
    assert bad_dates.status_code == 422


def test_create_study_accepts_consent_text_and_collaborators(
    client: TestClient, session: Session, make_user, bearer_headers
) -> None:
    creator = make_user(email="creator-consent@example.org")
    collaborator = make_user(email="collaborator@example.org")

    response = client.post(
        STUDIES,
        headers=bearer_headers(creator),
        json=_payload(
            consent_text="Texto de consentimento informado.",
            collaborators=[collaborator.email, creator.email],
        ),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["consent_text"] == "Texto de consentimento informado."
    members = session.scalars(
        select(StudyMember).where(StudyMember.study_id == uuid.UUID(body["id"]))
    ).all()
    roles = {member.user_id: member.role for member in members}
    assert roles == {
        creator.id: StudyRole.PRINCIPAL_INVESTIGATOR,
        collaborator.id: StudyRole.MEMBER,
    }
    shared = client.get(STUDIES, headers=bearer_headers(collaborator))
    assert [row["title"] for row in shared.json()] == ["Urban walks"]

    missing = client.post(
        STUDIES,
        headers=bearer_headers(creator),
        json=_payload(collaborators=["nobody@example.org"]),
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "user_not_found"


def test_list_shows_only_the_studies_where_the_user_is_a_member(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    bearer_headers,
) -> None:
    mine = make_study(title="Mine")
    other = make_study(title="Other")
    researcher = make_user(email="researcher@example.org")
    colleague = make_user(email="colleague@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, mine.id, researcher, StudyRole.MEMBER)
    _add_member(session, other.id, colleague, StudyRole.MEMBER)

    response = client.get(STUDIES, headers=bearer_headers(researcher))

    assert response.status_code == 200
    assert [row["title"] for row in response.json()] == ["Mine"]

    everything = client.get(STUDIES, headers=bearer_headers(admin))
    assert [row["title"] for row in everything.json()] == ["Mine", "Other"]


def _add_entry(session: Session, participant) -> None:
    session.add(
        Entry(
            participant_id=participant.id,
            entry_type=EntryType.TEXT,
            content_sha256="a" * 64,
            recorded_at=datetime.now(UTC),
        )
    )
    session.commit()


def test_list_includes_entry_and_active_participant_counts(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    counted = make_study(title="Counted")
    empty = make_study(title="Empty")
    researcher = make_user(email="counts@example.org")
    _add_member(session, counted.id, researcher, StudyRole.MEMBER)
    _add_member(session, empty.id, researcher, StudyRole.MEMBER)
    active = make_participant(counted, alias="P-01")
    make_participant(counted, alias="P-02")
    withdrawn = make_participant(counted, alias="P-03")
    withdrawn.status = ParticipantStatus.WITHDRAWN
    session.commit()
    _add_entry(session, active)
    _add_entry(session, active)
    _add_entry(session, withdrawn)

    response = client.get(STUDIES, headers=bearer_headers(researcher))

    assert response.status_code == 200
    rows = {row["title"]: row for row in response.json()}
    assert rows["Counted"]["entry_count"] == 3
    assert rows["Counted"]["participant_count"] == 2
    assert rows["Empty"]["entry_count"] == 0
    assert rows["Empty"]["participant_count"] == 0
    for row in rows.values():
        assert row["adherence_today"] == {"answered": 0, "out": 0, "percentage": 0.0}
        assert row["adherence_study"] == {"answered": 0, "out": 0, "percentage": 0.0}


def test_list_includes_today_and_study_adherence(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study(title="Adherent")
    researcher = make_user(email="adherence@example.org")
    _add_member(session, study.id, researcher, StudyRole.MEMBER)
    participant = make_participant(study)
    activity = Activity(
        study_id=study.id,
        title="Walk",
        entry_types=[EntryType.TEXT.value],
        prompts_per_day=4,
        window_start=time(8, 0),
        window_end=time(20, 0),
        min_gap_minutes=30,
        expected_minutes=5,
    )
    session.add(activity)
    session.flush()
    today = datetime.now(ZoneInfo("Europe/Lisbon")).date()
    yesterday = today - timedelta(days=1)
    rows = [
        (PromptStatus.ANSWERED, today),
        (PromptStatus.SENT, today),
        (PromptStatus.EXPIRED, today),
        (PromptStatus.PLANNED, today),
        (PromptStatus.ANSWERED, yesterday),
    ]
    for occurrence, (status, plan_date) in enumerate(rows):
        session.add(
            Prompt(
                participant_id=participant.id,
                activity_id=activity.id,
                plan_date=plan_date,
                occurrence=occurrence,
                status=status,
            )
        )
    session.commit()

    response = client.get(STUDIES, headers=bearer_headers(researcher))

    assert response.status_code == 200, response.text
    row = next(item for item in response.json() if item["title"] == "Adherent")
    assert row["adherence_today"] == {"answered": 1, "out": 3, "percentage": 33.3}
    assert row["adherence_study"] == {"answered": 2, "out": 4, "percentage": 50.0}


def test_get_a_study_checks_membership_and_administration(
    client: TestClient,
    session: Session,
    study: Study,
    make_user,
    bearer_headers,
) -> None:
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study.id, member, StudyRole.MEMBER)

    url = f"{STUDIES}/{study.id}"
    assert client.get(url, headers=bearer_headers(member)).status_code == 200
    assert client.get(url, headers=bearer_headers(admin)).status_code == 200
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403

    missing = f"{STUDIES}/{uuid.uuid4()}"
    assert client.get(missing, headers=bearer_headers(admin)).status_code == 404


def test_only_the_principal_investigator_updates_the_study(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_user,
    bearer_headers,
) -> None:
    co_investigator = make_user(email="co@example.org")
    _add_member(session, study.id, co_investigator, StudyRole.CO_INVESTIGATOR)

    url = f"{STUDIES}/{study.id}"
    refused = client.patch(url, headers=bearer_headers(co_investigator), json={"title": "Changed"})
    assert refused.status_code == 403

    accepted = client.patch(
        url,
        headers=bearer_headers(principal),
        json={"title": "Changed", "max_prompts_per_day": 6},
    )
    assert accepted.status_code == 200
    assert accepted.json()["title"] == "Changed"
    assert accepted.json()["max_prompts_per_day"] == 6

    null_title = client.patch(url, headers=bearer_headers(principal), json={"title": None})
    assert null_title.status_code == 422

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "study_updated")).one()
    assert audit.target == str(study.id)


def test_lifecycle_moves_from_draft_to_running_to_closed(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    bearer_headers,
) -> None:
    url = f"{STUDIES}/{study.id}"

    started = client.post(f"{url}/start", headers=bearer_headers(principal))
    assert started.status_code == 200
    assert started.json()["status"] == "running"

    started_again = client.post(f"{url}/start", headers=bearer_headers(principal))
    assert started_again.status_code == 409
    assert started_again.json()["error"]["code"] == "invalid_status_transition"

    closed = client.post(f"{url}/close", headers=bearer_headers(principal))
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    closed_again = client.post(f"{url}/close", headers=bearer_headers(principal))
    assert closed_again.status_code == 409

    actions = [row.action for row in session.scalars(select(AuditLog).order_by(AuditLog.id)).all()]
    assert actions.count("study_started") == 1
    assert actions.count("study_closed") == 1


def test_a_closed_study_cannot_be_changed(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    bearer_headers,
) -> None:
    study.status = StudyStatus.CLOSED
    session.commit()
    response = client.patch(
        f"{STUDIES}/{study.id}",
        headers=bearer_headers(principal),
        json={"title": "Late change"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "study_closed"


def test_the_principal_adds_members_by_email(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_user,
    bearer_headers,
) -> None:
    colleague = make_user(email="colleague@example.org")

    response = client.post(
        f"{STUDIES}/{study.id}/members",
        headers=bearer_headers(principal),
        json={"email": "Colleague@Example.org", "role": "co_investigator"},
    )

    assert response.status_code == 201, response.text
    assert response.json() == {
        "user_id": str(colleague.id),
        "email": "colleague@example.org",
        "role": "co_investigator",
    }

    listing = client.get(f"{STUDIES}/{study.id}/members", headers=bearer_headers(principal))
    assert listing.status_code == 200
    assert [row["email"] for row in listing.json()] == [
        "colleague@example.org",
        "principal@example.org",
    ]

    duplicate = client.post(
        f"{STUDIES}/{study.id}/members",
        headers=bearer_headers(principal),
        json={"email": colleague.email, "role": "member"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "already_a_member"

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "study_member_added")).one()
    assert audit.actor_id == principal.id


def test_adding_a_member_rejects_unknown_and_non_researcher_accounts(
    client: TestClient, study: Study, principal: UserAccount, make_user, bearer_headers
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)

    unknown = client.post(
        f"{STUDIES}/{study.id}/members",
        headers=bearer_headers(principal),
        json={"email": "nobody@example.org", "role": "member"},
    )
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "user_not_found"

    wrong_role = client.post(
        f"{STUDIES}/{study.id}/members",
        headers=bearer_headers(principal),
        json={"email": admin.email, "role": "member"},
    )
    assert wrong_role.status_code == 409
    assert wrong_role.json()["error"]["code"] == "not_a_researcher"


def test_a_member_cannot_manage_the_team(
    client: TestClient,
    session: Session,
    study: Study,
    make_user,
    bearer_headers,
) -> None:
    member = make_user(email="member@example.org")
    newcomer = make_user(email="newcomer@example.org")
    _add_member(session, study.id, member, StudyRole.MEMBER)

    response = client.post(
        f"{STUDIES}/{study.id}/members",
        headers=bearer_headers(member),
        json={"email": newcomer.email, "role": "member"},
    )
    assert response.status_code == 403


def test_roles_change_and_the_last_principal_investigator_is_protected(
    client: TestClient, study: Study, principal: UserAccount, bearer_headers
) -> None:
    url = f"{STUDIES}/{study.id}/members/{principal.id}"

    demote = client.patch(url, headers=bearer_headers(principal), json={"role": "member"})
    assert demote.status_code == 409
    assert demote.json()["error"]["code"] == "last_principal_investigator"

    remove = client.delete(url, headers=bearer_headers(principal))
    assert remove.status_code == 409

    changed = client.patch(
        url, headers=bearer_headers(principal), json={"role": "principal_investigator"}
    )
    assert changed.status_code == 200
    assert changed.json()["role"] == "principal_investigator"


def test_a_member_can_be_removed(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_user,
    bearer_headers,
) -> None:
    member = make_user(email="member@example.org")
    _add_member(session, study.id, member, StudyRole.MEMBER)

    response = client.delete(
        f"{STUDIES}/{study.id}/members/{member.id}", headers=bearer_headers(principal)
    )

    assert response.status_code == 204
    assert session.get(StudyMember, (study.id, member.id)) is None
    audit = session.scalars(select(AuditLog).where(AuditLog.action == "study_member_removed")).one()
    assert audit.target == str(member.id)


def test_study_questions_follow_fr_112(
    client: TestClient, session: Session, study: Study, principal: UserAccount, bearer_headers
) -> None:
    url = f"{STUDIES}/{study.id}/questions"

    single = client.post(
        url,
        headers=bearer_headers(principal),
        json={
            "kind": "single_choice",
            "text": "How do you travel?",
            "options": ["Walking", "Bus"],
        },
    )
    assert single.status_code == 201, single.text
    assert single.json()["position"] == 1
    assert single.json()["options"] == ["Walking", "Bus"]

    yes_no = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "yes_no", "text": "Did you go outside?"},
    )
    assert yes_no.status_code == 201
    assert yes_no.json()["position"] == 2

    one_option = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "multiple_choice", "text": "Pick", "options": ["Only one"]},
    )
    assert one_option.status_code == 422

    options_on_yes_no = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "yes_no", "text": "Yes?", "options": ["A", "B"]},
    )
    assert options_on_yes_no.status_code == 422

    short_text = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "short_text", "text": "Describe the walk."},
    )
    assert short_text.status_code == 201

    audit = session.scalars(
        select(AuditLog).where(AuditLog.action == "study_question_created")
    ).all()
    assert len(audit) == 3


def test_questions_can_be_updated_reordered_and_deleted(
    client: TestClient, session: Session, study: Study, principal: UserAccount, bearer_headers
) -> None:
    url = f"{STUDIES}/{study.id}/questions"
    first = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "yes_no", "text": "First?"},
    ).json()
    second = client.post(
        url,
        headers=bearer_headers(principal),
        json={"kind": "short_text", "text": "Second?"},
    ).json()

    update = client.patch(
        f"{url}/{first['id']}",
        headers=bearer_headers(principal),
        json={"kind": "single_choice", "options": ["A", "B"]},
    )
    assert update.status_code == 200
    assert update.json()["kind"] == "single_choice"
    assert update.json()["options"] == ["A", "B"]

    impossible = client.patch(
        f"{url}/{second['id']}",
        headers=bearer_headers(principal),
        json={"kind": "multiple_choice"},
    )
    assert impossible.status_code == 422
    assert impossible.json()["error"]["code"] == "invalid_question"

    null_text = client.patch(
        f"{url}/{second['id']}",
        headers=bearer_headers(principal),
        json={"text": None},
    )
    assert null_text.status_code == 422

    order = client.put(
        f"{url}/order",
        headers=bearer_headers(principal),
        json={"question_ids": [second["id"], first["id"]]},
    )
    assert order.status_code == 200
    assert [row["id"] for row in order.json()] == [second["id"], first["id"]]
    assert [row["position"] for row in order.json()] == [1, 2]

    mismatch = client.put(
        f"{url}/order",
        headers=bearer_headers(principal),
        json={"question_ids": [first["id"]]},
    )
    assert mismatch.status_code == 409
    assert mismatch.json()["error"]["code"] == "question_order_mismatch"

    deleted = client.delete(f"{url}/{first['id']}", headers=bearer_headers(principal))
    assert deleted.status_code == 204
    assert session.get(StudyQuestion, uuid.UUID(first["id"])) is None

    remaining = client.get(url, headers=bearer_headers(principal))
    assert [row["id"] for row in remaining.json()] == [second["id"]]


def test_tags_are_created_listed_and_deleted(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_study,
    bearer_headers,
) -> None:
    url = f"{STUDIES}/{study.id}/tags"

    created = client.post(url, headers=bearer_headers(principal), json={"name": " Outdoor "})
    assert created.status_code == 201
    assert created.json()["name"] == "Outdoor"
    tag_id = created.json()["id"]

    listing = client.get(url, headers=bearer_headers(principal))
    assert [row["name"] for row in listing.json()] == ["Outdoor"]

    other_study = make_study(title="Other")
    foreign = Tag(study_id=other_study.id, name="Foreign")
    session.add(foreign)
    session.commit()
    refused = client.delete(f"{url}/{foreign.id}", headers=bearer_headers(principal))
    assert refused.status_code == 404

    deleted = client.delete(f"{url}/{tag_id}", headers=bearer_headers(principal))
    assert deleted.status_code == 204
    assert session.get(Tag, uuid.UUID(tag_id)) is None
    audit = session.scalars(select(AuditLog).where(AuditLog.action == "tag_deleted")).one()
    assert audit.target == tag_id


def test_a_member_cannot_design_study_questions_but_can_read_and_tag(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_user,
    bearer_headers,
) -> None:
    member = make_user(email="member@example.org")
    _add_member(session, study.id, member, StudyRole.MEMBER)
    questions = f"{STUDIES}/{study.id}/questions"
    existing = client.post(
        questions,
        headers=bearer_headers(principal),
        json={"kind": "yes_no", "text": "Did you go outside?"},
    ).json()

    assert client.get(questions, headers=bearer_headers(member)).status_code == 200
    assert (
        client.post(
            questions,
            headers=bearer_headers(member),
            json={"kind": "yes_no", "text": "Another question?"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{questions}/{existing['id']}",
            headers=bearer_headers(member),
            json={"text": "Changed"},
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"{questions}/order",
            headers=bearer_headers(member),
            json={"question_ids": [existing["id"]]},
        ).status_code
        == 403
    )
    assert (
        client.delete(f"{questions}/{existing['id']}", headers=bearer_headers(member)).status_code
        == 403
    )

    tags = f"{STUDIES}/{study.id}/tags"
    created = client.post(tags, headers=bearer_headers(member), json={"name": "Outdoor"})
    assert created.status_code == 201
    assert client.get(tags, headers=bearer_headers(member)).status_code == 200
    assert (
        client.delete(f"{tags}/{created.json()['id']}", headers=bearer_headers(member)).status_code
        == 204
    )


def test_a_co_investigator_can_design_study_questions(
    client: TestClient,
    session: Session,
    study: Study,
    make_user,
    bearer_headers,
) -> None:
    co_investigator = make_user(email="co@example.org")
    _add_member(session, study.id, co_investigator, StudyRole.CO_INVESTIGATOR)
    url = f"{STUDIES}/{study.id}/questions"

    first = client.post(
        url, headers=bearer_headers(co_investigator), json={"kind": "yes_no", "text": "First?"}
    )
    second = client.post(
        url,
        headers=bearer_headers(co_investigator),
        json={"kind": "short_text", "text": "Second?"},
    )
    assert first.status_code == second.status_code == 201

    updated = client.patch(
        f"{url}/{first.json()['id']}",
        headers=bearer_headers(co_investigator),
        json={"text": "First, changed?"},
    )
    assert updated.status_code == 200
    assert updated.json()["text"] == "First, changed?"

    order = client.put(
        f"{url}/order",
        headers=bearer_headers(co_investigator),
        json={"question_ids": [second.json()["id"], first.json()["id"]]},
    )
    assert order.status_code == 200

    removed = client.delete(f"{url}/{first.json()['id']}", headers=bearer_headers(co_investigator))
    assert removed.status_code == 204


def test_consent_summary_counts_active_participants_on_the_current_version(
    client: TestClient,
    session: Session,
    study: Study,
    principal: UserAccount,
    make_participant,
    make_user,
    bearer_headers,
) -> None:
    from app.models import Consent
    from app.models.enums import ParticipantStatus
    from app.services.participation import CONSENT_VERSION

    accepted = make_participant(study, alias="P01")
    old_version = make_participant(study, alias="P02")
    declined = make_participant(study, alias="P03")
    declined.status = ParticipantStatus.DECLINED
    session.commit()
    session.add_all(
        [
            Consent(participant_id=accepted.id, version=CONSENT_VERSION),
            Consent(participant_id=accepted.id, version=CONSENT_VERSION),
            Consent(participant_id=old_version.id, version="0.9"),
            Consent(participant_id=declined.id, version=CONSENT_VERSION),
        ]
    )
    session.commit()

    url = f"{STUDIES}/{study.id}/consent"
    response = client.get(url, headers=bearer_headers(principal))

    assert response.status_code == 200, response.text
    assert response.json() == {"version": CONSENT_VERSION, "accepted": 1}

    outsider = make_user(email="outsider@example.org")
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403
    assert client.get(url).status_code == 401
