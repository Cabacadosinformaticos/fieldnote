import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Entry,
    ErasureRequest,
    MediaObject,
    Participant,
    ParticipantIdentity,
    StudyMember,
)
from app.models.enums import EntryType, ParticipantStatus, StudyRole, UserRole
from app.services import erasure_requests as service
from app.services import storage

API = "/api/v1"


def _url(study, participant) -> str:
    return f"{API}/studies/{study.id}/participants/{participant.id}/erasure-request"


def _add_member(session: Session, study, user, role: StudyRole) -> None:
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _named_user(make_user, session: Session, email: str, name: str | None):
    user = make_user(email=email)
    user.name = name
    session.commit()
    return user


def _entry(
    session: Session,
    participant,
    *,
    kind: EntryType = EntryType.TEXT,
    key: str = "a" * 64,
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        entry_type=kind,
        content_sha256=key,
        recorded_at=datetime.now(UTC),
    )
    session.add(entry)
    session.commit()
    return entry


def _media(session: Session, participant, entry) -> MediaObject:
    media = MediaObject(
        entry_id=entry.id,
        object_key=f"entries/{participant.id}/{entry.id}/photo.jpg",
        mime_type="image/jpeg",
        size_bytes=10,
        sha256="b" * 64,
    )
    session.add(media)
    session.commit()
    return media


def _no_files(monkeypatch) -> None:
    monkeypatch.setattr(storage, "delete_participant_objects", lambda _participant_id: 0)


def test_owner_creates_a_request_and_the_admin_card_has_the_counts(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study(title="Pequenos-almoços em casa")
    owner = _named_user(make_user, session, "owner@example.org", "Rita Ferraz")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study, alias="P-05")
    other = make_participant(study, alias="P-06")
    session.add(ParticipantIdentity(participant_id=participant.id, name="Ana", email="a@e.org"))
    session.commit()
    text = _entry(session, participant, kind=EntryType.TEXT)
    photo = _entry(session, participant, kind=EntryType.PHOTO, key="c" * 64)
    _media(session, participant, photo)
    _entry(session, other, kind=EntryType.TEXT, key="d" * 64)
    received_at = datetime.now(UTC) - timedelta(days=2)

    created = client.post(
        _url(study, participant),
        headers=bearer_headers(owner),
        json={"received_at": received_at.isoformat()},
    )

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert body["participant_id"] == str(participant.id)
    assert body["study_id"] == str(study.id)
    assert body["requested_by"] == str(owner.id)
    assert body["requested_by_name"] == "Rita Ferraz"
    assert body["received_at"].startswith(received_at.date().isoformat())

    stored = session.scalar(
        select(ErasureRequest).where(ErasureRequest.participant_id == participant.id)
    )
    assert stored is not None and stored.status == "pending"
    audit = session.scalar(select(AuditLog).where(AuditLog.action == "erasure_request_created"))
    assert audit is not None and audit.actor_id == owner.id

    pending = client.get(_url(study, participant), headers=bearer_headers(owner))
    assert pending.status_code == 200
    assert pending.json()["id"] == body["id"]

    listing = client.get(f"{API}/admin/erasure-requests", headers=bearer_headers(owner))
    assert listing.status_code == 403
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    listing = client.get(f"{API}/admin/erasure-requests", headers=bearer_headers(admin))
    assert listing.status_code == 200, listing.text
    rows = listing.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["alias"] == "P-05"
    assert row["study_title"] == "Pequenos-almoços em casa"
    assert row["requested_by_name"] == "Rita Ferraz"
    assert row["requested_by_role"] == "principal_investigator"
    assert row["counts"] == {
        "entries": 2,
        "files": 1,
        "entry_types": {"text": 1, "photo": 1},
        "has_identity": True,
        "study_participants": 2,
        "study_entries": 3,
    }
    assert text.id != photo.id


def test_create_requires_the_study_owner(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    owner = make_user(email="owner@example.org")
    co = make_user(email="co@example.org")
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study, co, StudyRole.CO_INVESTIGATOR)
    _add_member(session, study, member, StudyRole.MEMBER)
    _add_member(session, other_study, outsider, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study)
    outsider_participant = make_participant(other_study)
    payload = {"received_at": datetime.now(UTC).isoformat()}

    assert client.post(_url(study, participant), json=payload).status_code == 401
    for user in (co, member):
        response = client.post(_url(study, participant), headers=bearer_headers(user), json=payload)
        assert response.status_code == 403
    response = client.post(_url(study, participant), headers=bearer_headers(outsider), json=payload)
    assert response.status_code == 403
    response = client.post(
        _url(other_study, outsider_participant),
        headers=bearer_headers(owner),
        json=payload,
    )
    assert response.status_code == 403
    response = client.post(_url(study, participant), headers=bearer_headers(admin), json=payload)
    assert response.status_code == 201, response.text


def test_one_pending_request_per_participant(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study)
    payload = {"received_at": datetime.now(UTC).isoformat()}

    created = client.post(_url(study, participant), headers=bearer_headers(owner), json=payload)
    assert created.status_code == 201
    second = client.post(_url(study, participant), headers=bearer_headers(owner), json=payload)

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "erasure_request_pending"


def test_request_is_refused_while_the_app_already_schedules_an_erasure(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study)
    now = datetime.now(UTC)
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_requested_at = now
    participant.erasure_due_at = now + timedelta(days=7)
    session.commit()

    response = client.post(
        _url(study, participant),
        headers=bearer_headers(owner),
        json={"received_at": now.isoformat()},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "erasure_scheduled"


def test_a_participant_of_another_study_is_not_found(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    owner = make_user(email="owner@example.org")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, other_study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    outsider = make_participant(other_study)

    response = client.post(
        _url(study, outsider),
        headers=bearer_headers(owner),
        json={"received_at": datetime.now(UTC).isoformat()},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "participant_not_found"


def test_the_team_can_cancel_a_pending_request(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    owner = make_user(email="owner@example.org")
    co = make_user(email="co@example.org")
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study, co, StudyRole.CO_INVESTIGATOR)
    _add_member(session, study, member, StudyRole.MEMBER)
    _add_member(session, other_study, outsider, StudyRole.PRINCIPAL_INVESTIGATOR)
    payload = {"received_at": datetime.now(UTC).isoformat()}

    for actor in (co, member, owner, admin):
        participant = make_participant(study, alias=f"P-{actor.email[0].upper()}")
        assert (
            client.post(
                _url(study, participant), headers=bearer_headers(owner), json=payload
            ).status_code
            == 201
        )
        response = client.delete(_url(study, participant), headers=bearer_headers(actor))
        assert response.status_code == 204, response.text
        assert service.pending_request(session, study.id, participant.id) is None

    participant = make_participant(study, alias="P-Z")
    assert (
        client.post(
            _url(study, participant), headers=bearer_headers(owner), json=payload
        ).status_code
        == 201
    )
    forbidden = client.delete(_url(study, participant), headers=bearer_headers(outsider))
    assert forbidden.status_code == 403
    missing = client.delete(_url(study, participant), headers=bearer_headers(owner))
    assert missing.status_code == 204
    again = client.delete(_url(study, participant), headers=bearer_headers(owner))
    assert again.status_code == 404

    cancelled = session.scalar(
        select(AuditLog).where(AuditLog.action == "erasure_request_cancelled")
    )
    assert cancelled is not None
    assert cancelled.details is not None and "request_id" in cancelled.details


def test_get_returns_null_when_there_is_no_pending_request(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    owner = make_user(email="owner@example.org")
    outsider = make_user(email="outsider@example.org")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, other_study, outsider, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study)

    response = client.get(_url(study, participant), headers=bearer_headers(owner))
    assert response.status_code == 200
    assert response.json() is None

    forbidden = client.get(_url(study, participant), headers=bearer_headers(outsider))
    assert forbidden.status_code == 403


def test_the_admin_erasure_closes_the_request_and_audits_it(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study, alias="P-05")
    _entry(session, participant)
    _no_files(monkeypatch)
    created = client.post(
        _url(study, participant),
        headers=bearer_headers(owner),
        json={"received_at": datetime.now(UTC).isoformat()},
    )
    assert created.status_code == 201
    request_id = created.json()["id"]
    participant_id = participant.id

    erased = client.post(
        f"{API}/admin/participants/{participant_id}/erasure",
        headers=bearer_headers(admin),
    )

    assert erased.status_code == 200, erased.text
    session.expire_all()
    assert session.get(Participant, participant_id) is None
    # The participant foreign key cascades, so only the audit row remains as the record.
    assert session.get(ErasureRequest, uuid.UUID(request_id)) is None
    done = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "erasure_request_done",
            AuditLog.target == str(participant_id),
        )
    )
    assert done is not None
    assert done.actor_id == admin.id
    assert done.details is not None
    assert done.details["request_id"] == request_id
    assert done.details["study_id"] == str(study.id)
    assert session.scalar(select(ErasureRequest.id)) is None


def test_mark_done_sets_the_status_and_the_administrator(
    session: Session,
    make_user,
    make_study,
    make_participant,
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study)
    request = service.create_request(
        session,
        study.id,
        participant.id,
        owner,
        datetime.now(UTC) - timedelta(days=1),
    )

    closed = service.mark_done(session, participant.id, admin)

    assert closed is not None
    stored = session.get(ErasureRequest, request.id)
    assert stored is not None
    assert stored.status == "done"
    assert stored.done_by == admin.id
    assert stored.done_at is not None
    assert service.pending_request(session, study.id, participant.id) is None
