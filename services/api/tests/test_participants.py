from datetime import UTC, date, datetime, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    AuditLog,
    Entry,
    InviteCode,
    Participant,
    ParticipantIdentity,
    Prompt,
    StudyMember,
)
from app.models.enums import (
    EntryType,
    InviteCodeKind,
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    UserRole,
)
from app.security import codes, tokens

API = "/api/v1"


def _url(study, suffix: str = "") -> str:
    return f"{API}/studies/{study.id}/participants{suffix}"


def _add_member(session: Session, study, user, role: StudyRole = StudyRole.MEMBER) -> None:
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _add_participant(client: TestClient, study, headers, **body) -> dict:
    response = client.post(_url(study), headers=headers, json={"alias": "P-01", **body})
    assert response.status_code == 201, response.text
    return response.json()


def test_add_participant_returns_the_personal_code_once_and_stores_only_its_hash(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)

    response = client.post(
        _url(study),
        headers=bearer_headers(user),
        json={"alias": "P-01", "name": "Ana Silva", "email": "ana@example.org"},
    )

    assert response.status_code == 201
    body = response.json()
    raw = body["invite_code"]["code"]
    assert codes.is_personal_code(raw)
    expires_at = datetime.fromisoformat(body["invite_code"]["expires_at"])
    assert timedelta(days=6, hours=23) < expires_at - datetime.now(UTC) <= timedelta(days=7)
    assert body["alias"] == "P-01"
    assert body["status"] == "active"
    assert body["entry_route"] == "personal_code"

    participant = session.scalar(select(Participant).where(Participant.alias == "P-01"))
    assert participant is not None
    assert str(participant.id) == body["id"]
    identity = session.get(ParticipantIdentity, participant.id)
    assert identity is not None and (identity.name, identity.email) == (
        "Ana Silva",
        "ana@example.org",
    )

    stored = session.scalar(select(InviteCode).where(InviteCode.participant_id == participant.id))
    assert stored is not None
    assert stored.kind == InviteCodeKind.PERSONAL
    assert stored.code_value is None
    assert stored.code_hash == codes.hash_code(raw)
    assert stored.used_at is None
    assert stored.expires_at == expires_at

    actions = {
        row.action
        for row in session.scalars(select(AuditLog).where(AuditLog.target == str(participant.id)))
    }
    assert {"participant_added", "participant_invite_issued"} <= actions


def test_add_participant_without_name_or_email_creates_no_identity_row(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)

    _add_participant(client, study, bearer_headers(user))

    assert session.scalars(select(ParticipantIdentity)).all() == []


def test_participant_endpoints_refuse_outsiders_and_anonymous_callers(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    outsider = make_user(email="outsider@example.org")

    assert client.get(_url(study)).status_code == 401
    assert (
        client.post(
            _url(study), headers=bearer_headers(outsider), json={"alias": "P-01"}
        ).status_code
        == 403
    )
    assert client.get(_url(study), headers=bearer_headers(outsider)).status_code == 403


def test_issuing_a_new_personal_code_replaces_the_unused_one(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    added = _add_participant(client, study, headers)
    old_code = added["invite_code"]["code"]
    participant_id = added["id"]

    response = client.post(_url(study, f"/{participant_id}/invite-code"), headers=headers)

    assert response.status_code == 201
    new_code = response.json()["code"]
    assert new_code != old_code
    assert codes.is_personal_code(new_code)
    session.expire_all()
    assert (
        session.scalar(select(InviteCode).where(InviteCode.code_hash == codes.hash_code(old_code)))
        is None
    )
    stored = session.scalar(
        select(InviteCode).where(InviteCode.code_hash == codes.hash_code(new_code))
    )
    assert stored is not None
    audits = session.scalars(
        select(AuditLog).where(
            AuditLog.target == participant_id, AuditLog.action == "participant_invite_issued"
        )
    ).all()
    assert len(audits) == 2


def test_list_shows_states_and_how_each_participant_entered(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    added = _add_participant(client, study, headers)

    study_code = InviteCode(
        study_id=study.id,
        kind=InviteCodeKind.STUDY,
        code_value=codes.generate_study_code(),
        name="Cartaz",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(study_code)
    session.flush()
    pending = Participant(
        study_id=study.id,
        status=ParticipantStatus.PENDING_APPROVAL,
        admitted_by_code_id=study_code.id,
        entered_at=datetime.now(UTC),
        device_token_hash=tokens.hash_token(codes.generate_device_token()),
    )
    removed = Participant(
        study_id=study.id,
        alias="P-09",
        status=ParticipantStatus.REMOVED,
        entered_at=datetime.now(UTC),
        erasure_due_at=None,
    )
    erasing = Participant(
        study_id=study.id,
        alias="P-10",
        status=ParticipantStatus.ERASURE_SCHEDULED,
        entered_at=datetime.now(UTC),
        erasure_due_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add_all([pending, removed, erasing])
    session.commit()

    response = client.get(_url(study), headers=headers)

    assert response.status_code == 200
    rows = {row["id"]: row for row in response.json()}
    assert rows[added["id"]]["entry_route"] == "personal_code"
    assert rows[str(pending.id)]["alias"] is None
    assert rows[str(pending.id)]["status"] == "pending_approval"
    assert rows[str(pending.id)]["entry_route"] == "study_code"
    assert rows[str(removed.id)]["status"] == "removed"
    assert rows[str(removed.id)]["entry_route"] == "pool"
    assert rows[str(erasing.id)]["status"] == "erasure_scheduled"
    assert rows[str(erasing.id)]["erasure_due_at"] is not None
    assert rows[str(erasing.id)]["entered_at"] is None
    assert rows[str(erasing.id)]["entry_route"] is None


def test_get_one_participant_is_scoped_to_the_study(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    added = _add_participant(client, study, headers)
    foreign = Participant(study_id=other_study.id, alias="X-01", entered_at=datetime.now(UTC))
    session.add(foreign)
    session.commit()

    found = client.get(_url(study, f"/{added['id']}"), headers=headers)
    missing = client.get(_url(study, f"/{foreign.id}"), headers=headers)

    assert found.status_code == 200
    assert found.json()["alias"] == "P-01"
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "participant_not_found"


def test_remove_cancels_planned_prompts_keeps_sent_ones_and_audits(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    added = _add_participant(client, study, headers)
    participant = session.get(Participant, added["id"])
    assert participant is not None

    activity = Activity(
        study_id=study.id,
        title="Walk",
        entry_types=["text"],
        prompts_per_day=1,
        window_start=time(9, 0),
        window_end=time(21, 0),
        min_gap_minutes=60,
        expected_minutes=5,
    )
    session.add(activity)
    session.flush()
    planned = Prompt(
        activity_id=activity.id,
        participant_id=participant.id,
        plan_date=date.today(),
        occurrence=1,
        status=PromptStatus.PLANNED,
    )
    sent = Prompt(
        activity_id=activity.id,
        participant_id=participant.id,
        plan_date=date.today(),
        occurrence=2,
        status=PromptStatus.SENT,
        sent_at=datetime.now(UTC),
    )
    entry = Entry(
        participant_id=participant.id,
        activity_id=activity.id,
        entry_type=EntryType.TEXT,
        content_sha256="a" * 64,
        recorded_at=datetime.now(UTC),
        body="already sent",
    )
    session.add_all([planned, sent, entry])
    session.commit()
    planned_id, sent_id, entry_id = planned.id, sent.id, entry.id

    response = client.post(_url(study, f"/{added['id']}/remove"), headers=headers)

    assert response.status_code == 204
    session.expire_all()
    assert session.get(Participant, participant.id).status == ParticipantStatus.REMOVED
    assert session.get(Prompt, planned_id) is None
    assert session.get(Prompt, sent_id) is not None
    assert session.get(Entry, entry_id) is not None
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.target == str(participant.id), AuditLog.action == "participant_removed"
        )
    )
    assert audit is not None


def test_identity_is_readable_only_by_the_owner_and_admins_and_every_read_is_audited(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    co_investigator = make_user(email="co@example.org")
    member = make_user(email="member@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study, co_investigator, StudyRole.CO_INVESTIGATOR)
    _add_member(session, study, member, StudyRole.MEMBER)
    added = _add_participant(
        client,
        study,
        bearer_headers(owner),
        name="Ana Silva",
        email="ana@example.org",
    )
    url = _url(study, f"/{added['id']}/identity")

    assert client.get(url, headers=bearer_headers(co_investigator)).status_code == 403
    assert client.get(url, headers=bearer_headers(member)).status_code == 403

    owner_read = client.get(url, headers=bearer_headers(owner))
    assert owner_read.status_code == 200
    assert owner_read.json() == {"name": "Ana Silva", "email": "ana@example.org"}
    admin_read = client.get(url, headers=bearer_headers(admin))
    assert admin_read.status_code == 200
    assert admin_read.json() == {"name": "Ana Silva", "email": "ana@example.org"}

    reads = session.scalars(
        select(AuditLog).where(
            AuditLog.target == added["id"], AuditLog.action == "participant_identity_read"
        )
    ).all()
    assert len(reads) == 2
    assert {row.actor_id for row in reads} == {owner.id, admin.id}


def test_identity_is_hidden_while_an_erasure_is_scheduled(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    owner = make_user()
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    headers = bearer_headers(owner)
    added = _add_participant(client, study, headers, name="Ana")
    participant = session.get(Participant, added["id"])
    assert participant is not None
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_due_at = datetime.now(UTC) + timedelta(days=7)
    session.commit()

    response = client.get(_url(study, f"/{added['id']}/identity"), headers=headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "participant_not_found"
    assert (
        session.scalar(select(AuditLog).where(AuditLog.action == "participant_identity_read"))
        is None
    )
