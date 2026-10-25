import json
import uuid
from datetime import UTC, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.erasure_job import run_once
from app.models import (
    AccountParticipation,
    AuditLog,
    Availability,
    Consent,
    Entry,
    MediaObject,
    Participant,
    ParticipantAccount,
    ParticipantIdentity,
    StudyAnswer,
)
from app.models.enums import (
    AuditActorType,
    EntryType,
    ParticipantStatus,
    QuestionKind,
    UserRole,
)
from app.security.audit import record
from app.services import storage

API = "/api/v1"
ADMIN = f"{API}/admin"


@pytest.fixture
def admin(make_user):
    return make_user(email="admin@example.org", role=UserRole.ADMIN)


@pytest.fixture
def researcher(make_user):
    return make_user(email="researcher@example.org")


def _seed(
    session: Session,
    study,
    make_participant,
    *,
    alias: str = "P-01",
    device_token: str | None = None,
):
    """A participant with every kind of row an erasure must remove."""
    participant = make_participant(study, device_token=device_token, alias=alias)
    participant.device_hash = "d" * 64
    participant.push_token = "push-token"
    now = datetime.now(UTC)
    session.add_all(
        [
            ParticipantIdentity(
                participant_id=participant.id,
                name="Ana Silva",
                email="ana@example.org",
            ),
            Consent(participant_id=participant.id, version="1.0", accepted_at=now),
            Availability(
                participant_id=participant.id,
                start_time=time(9, 0),
                end_time=time(18, 0),
                weekdays=[1, 2, 3],
            ),
            StudyAnswer(
                participant_id=participant.id,
                question_text="Why?",
                kind=QuestionKind.SHORT_TEXT,
                answer="Because",
            ),
        ]
    )
    entry = Entry(
        participant_id=participant.id,
        entry_type=EntryType.TEXT,
        content_sha256="a" * 64,
        recorded_at=now,
        body="an entry",
    )
    session.add(entry)
    session.flush()
    media = MediaObject(
        entry_id=entry.id,
        object_key=f"entries/{participant.id}/{entry.id}/{uuid.uuid4()}",
        mime_type="image/jpeg",
        size_bytes=10,
        sha256="b" * 64,
    )
    account = ParticipantAccount(
        recovery_hash="recovery-hash",
        recovery_lookup=f"lookup-{participant.id}",
    )
    session.add_all([media, account])
    session.flush()
    session.add(
        AccountParticipation(
            participant_id=participant.id,
            account_id=account.id,
            study_id=study.id,
        )
    )
    session.commit()
    return participant, entry, media, account


def _delete_file_calls(monkeypatch, deleted_files: int = 4) -> list[uuid.UUID]:
    calls: list[uuid.UUID] = []

    def fake_delete(participant_id: uuid.UUID) -> int:
        calls.append(participant_id)
        return deleted_files

    monkeypatch.setattr(storage, "delete_participant_objects", fake_delete)
    return calls


def test_admin_erasure_removes_rows_files_and_audits_without_personal_data(
    client: TestClient,
    session: Session,
    admin,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    participant, entry, media, account = _seed(
        session, study, make_participant, device_token="raw-device-token"
    )
    calls = _delete_file_calls(monkeypatch)
    participant_id = participant.id
    entry_id, media_id = entry.id, media.id
    account_id = account.id

    response = client.post(
        f"{ADMIN}/participants/{participant_id}/erasure",
        headers=bearer_headers(admin),
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "participant_id": str(participant_id),
        "entries_deleted": 1,
        "files_deleted": 4,
    }
    assert calls == [participant_id]

    session.expire_all()
    assert session.get(Participant, participant_id) is None
    assert session.get(ParticipantIdentity, participant_id) is None
    for model in (Consent, Availability, StudyAnswer, AccountParticipation):
        assert (
            session.scalars(select(model).where(model.participant_id == participant_id)).all() == []
        )
    assert session.get(Entry, entry_id) is None
    assert session.get(MediaObject, media_id) is None
    assert session.get(ParticipantAccount, account_id) is not None

    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "participant_erased",
            AuditLog.target == str(participant_id),
        )
    )
    assert audit is not None
    assert audit.actor_type == AuditActorType.USER
    assert audit.actor_id == admin.id
    assert audit.details == {
        "study_id": str(study.id),
        "entries": 1,
        "files": 4,
    }
    serialised = json.dumps(audit.details)
    assert "Ana" not in serialised
    assert "ana@example.org" not in serialised

    device = client.get(
        f"{API}/participation/me", headers={"Authorization": "Device raw-device-token"}
    )
    assert device.status_code == 401


def test_admin_erasure_refuses_a_participant_scheduled_by_the_app(
    client: TestClient,
    session: Session,
    admin,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    participant = make_participant(study)
    now = datetime.now(UTC)
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_requested_at = now
    participant.erasure_due_at = now + timedelta(days=7)
    session.commit()
    calls = _delete_file_calls(monkeypatch)

    response = client.post(
        f"{ADMIN}/participants/{participant.id}/erasure",
        headers=bearer_headers(admin),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "erasure_scheduled"
    assert calls == []
    session.expire_all()
    assert session.get(Participant, participant.id) is not None


def test_erasure_endpoints_are_admin_only(
    client: TestClient,
    researcher,
    make_study,
    make_participant,
    bearer_headers,
) -> None:
    study = make_study()
    participant = make_participant(study)
    url = f"{ADMIN}/participants/{participant.id}/erasure"

    assert client.post(url).status_code == 401
    assert client.post(url, headers=bearer_headers(researcher)).status_code == 403
    assert client.get(f"{ADMIN}/erasures", headers=bearer_headers(researcher)).status_code == 403


def test_erasures_list_shows_scheduled_and_completed_ones(
    client: TestClient,
    session: Session,
    admin,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    now = datetime.now(UTC)
    scheduled = make_participant(study, alias="P-07")
    scheduled.status = ParticipantStatus.ERASURE_SCHEDULED
    scheduled.erasure_requested_at = now
    scheduled.erasure_due_at = now + timedelta(days=7)
    session.commit()

    erased, _, _, _ = _seed(session, study, make_participant, alias="P-08")
    _delete_file_calls(monkeypatch, deleted_files=2)
    erased_id = erased.id
    response = client.post(
        f"{ADMIN}/participants/{erased_id}/erasure",
        headers=bearer_headers(admin),
    )
    assert response.status_code == 200

    listing = client.get(f"{ADMIN}/erasures", headers=bearer_headers(admin))

    assert listing.status_code == 200
    body = listing.json()
    assert [row["participant_id"] for row in body["scheduled"]] == [str(scheduled.id)]
    assert body["scheduled"][0]["alias"] == "P-07"
    assert body["scheduled"][0]["study_id"] == str(study.id)
    assert body["scheduled"][0]["study_title"] == study.title
    assert body["scheduled"][0]["requested_at"] is not None
    assert body["scheduled"][0]["due_at"] is not None
    assert body["completed"][0]["participant_id"] == str(erased_id)
    assert body["completed"][0]["study_id"] == str(study.id)
    assert body["completed"][0]["study_title"] == study.title
    assert body["completed"][0]["actor_type"] == "user"
    assert body["completed"][0]["actor_id"] == str(admin.id)
    assert body["completed"][0]["entries"] == 1
    assert body["completed"][0]["files"] == 2


def test_job_erases_only_due_participants_and_runs_twice_safely(
    session: Session,
    make_study,
    make_participant,
    monkeypatch,
) -> None:
    study = make_study()
    due, due_entry, due_media, _ = _seed(session, study, make_participant, alias="P-01")
    entry_id, media_id = due_entry.id, due_media.id
    now = datetime.now(UTC)
    due.status = ParticipantStatus.ERASURE_SCHEDULED
    due.erasure_requested_at = now - timedelta(days=7)
    due.erasure_due_at = now - timedelta(hours=1)
    later = make_participant(study, alias="P-02")
    later.status = ParticipantStatus.ERASURE_SCHEDULED
    later.erasure_requested_at = now
    later.erasure_due_at = now + timedelta(hours=1)
    active = make_participant(study, alias="P-03")
    session.commit()
    calls = _delete_file_calls(monkeypatch, deleted_files=3)
    due_id = due.id

    assert run_once(session) == 1

    assert calls == [due_id]
    session.expire_all()
    assert session.get(Participant, due_id) is None
    assert session.get(Entry, entry_id) is None
    assert session.get(MediaObject, media_id) is None
    assert session.get(Participant, later.id) is not None
    assert session.get(Participant, active.id) is not None
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "participant_erased",
            AuditLog.target == str(due_id),
        )
    )
    assert audit is not None
    assert audit.actor_type == AuditActorType.SYSTEM
    assert audit.actor_id is None
    assert audit.details == {"study_id": str(study.id), "entries": 1, "files": 3}

    assert run_once(session) == 0


def test_job_does_nothing_when_no_erasure_is_due(
    session: Session, make_study, make_participant, monkeypatch
) -> None:
    study = make_study()
    participant = make_participant(study)
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    participant.erasure_due_at = datetime.now(UTC) + timedelta(days=7)
    session.commit()
    calls = _delete_file_calls(monkeypatch)

    assert run_once(session) == 0
    assert calls == []
    assert session.get(Participant, participant.id) is not None


def test_job_audits_a_due_request_whose_participant_row_is_gone(
    session: Session, monkeypatch
) -> None:
    now = datetime.now(UTC)
    missing_id = uuid.uuid4()
    future_id = uuid.uuid4()
    record(
        session,
        None,
        "erasure_requested",
        target=str(missing_id),
        details={"due_at": (now - timedelta(minutes=5)).isoformat()},
        actor_type=AuditActorType.PARTICIPANT,
    )
    record(
        session,
        None,
        "erasure_requested",
        target=str(future_id),
        details={"due_at": (now + timedelta(days=7)).isoformat()},
        actor_type=AuditActorType.PARTICIPANT,
    )
    session.commit()
    calls = _delete_file_calls(monkeypatch)

    assert run_once(session) == 1

    assert calls == []
    audit = session.scalar(
        select(AuditLog).where(
            AuditLog.action == "participant_erased",
            AuditLog.target == str(missing_id),
        )
    )
    assert audit is not None
    assert audit.actor_type == AuditActorType.SYSTEM
    assert audit.details == {"entries": 0, "files": 0}
    assert (
        session.scalar(
            select(AuditLog.id).where(
                AuditLog.action == "participant_erased",
                AuditLog.target == str(future_id),
            )
        )
        is None
    )
    assert run_once(session) == 0
