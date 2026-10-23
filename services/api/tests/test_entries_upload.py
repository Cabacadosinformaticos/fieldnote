import uuid
from datetime import UTC, date, datetime, time, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Activity, AuditLog, Entry, MediaObject, OutboxEvent, Participant, Prompt
from app.models.enums import MediaStatus, ParticipantStatus, PromptStatus
from app.services import storage

DEVICE_TOKEN = "device-token-for-the-entry-tests"
UPLOAD_URL = "/api/v1/media/upload-url"
ENTRIES = "/api/v1/entries"
SHA_A = "a" * 64
SHA_B = "b" * 64


def device_headers(token: str = DEVICE_TOKEN) -> dict[str, str]:
    return {"Authorization": f"Device {token}"}


def entry_payload(activity: Activity, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": str(uuid.uuid4()),
        "activity_id": str(activity.id),
        "entry_type": "text",
        "content_sha256": SHA_A,
        "recorded_at": "2026-11-01T10:00:00+00:00",
        "body": "A note",
    }
    payload.update(overrides)
    return payload


def upload_payload(entry_id: uuid.UUID | None = None, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "entry_id": str(entry_id or uuid.uuid4()),
        "mime_type": "image/jpeg",
        "size_bytes": 1024,
        "sha256": "c" * 64,
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def study(make_study):
    return make_study()


@pytest.fixture
def participant(study, make_participant):
    return make_participant(study, device_token=DEVICE_TOKEN)


@pytest.fixture
def make_activity(session: Session, study):
    def _make_activity(
        entry_types: tuple[str, ...] = ("text",),
        *,
        options: dict[str, object] | None = None,
        capture_location: bool = False,
        allow_free_entries: bool = True,
        max_free_entries_per_day: int | None = None,
    ) -> Activity:
        activity = Activity(
            study_id=study.id,
            title="An activity",
            entry_types=list(entry_types),
            options=options,
            prompts_per_day=1,
            window_start=time(8, 0),
            window_end=time(20, 0),
            min_gap_minutes=30,
            capture_location=capture_location,
            allow_free_entries=allow_free_entries,
            max_free_entries_per_day=max_free_entries_per_day,
            expected_minutes=5,
        )
        session.add(activity)
        session.commit()
        return activity

    return _make_activity


@pytest.fixture
def activity(make_activity) -> Activity:
    return make_activity()


@pytest.fixture
def make_prompt(session: Session):
    def _make_prompt(
        participant: Participant,
        activity: Activity,
        status: PromptStatus = PromptStatus.SENT,
    ) -> Prompt:
        prompt = Prompt(
            activity_id=activity.id,
            participant_id=participant.id,
            plan_date=date(2026, 11, 1),
            occurrence=0,
            scheduled_at=datetime(2026, 11, 1, 10, 0, tzinfo=UTC),
            status=status,
        )
        session.add(prompt)
        session.commit()
        return prompt

    return _make_prompt


@pytest.fixture
def make_media(session: Session, participant):
    def _make_media(
        entry_id: uuid.UUID,
        *,
        mime_type: str = "image/jpeg",
        status: MediaStatus = MediaStatus.PENDING,
        owner: Participant | None = None,
    ) -> MediaObject:
        media_id = uuid.uuid4()
        owner_id = (owner or participant).id
        media = MediaObject(
            id=media_id,
            entry_id=None,
            object_key=storage.upload_object_key(owner_id, entry_id, media_id),
            mime_type=mime_type,
            size_bytes=1024,
            sha256=SHA_B,
            status=status,
        )
        session.add(media)
        session.commit()
        return media

    return _make_media


def test_upload_url_is_signed_for_the_public_media_path(
    client: TestClient, session: Session, participant: Participant
) -> None:
    entry_id = uuid.uuid4()

    response = client.post(UPLOAD_URL, headers=device_headers(), json=upload_payload(entry_id))

    assert response.status_code == 201
    body = response.json()
    assert body["method"] == "PUT"
    assert body["headers"] == {"Content-Type": "image/jpeg", "Content-Length": "1024"}

    media = session.get(MediaObject, uuid.UUID(body["media_object_id"]))
    assert media is not None
    assert media.status == MediaStatus.PENDING
    assert media.entry_id is None
    assert media.mime_type == "image/jpeg"
    assert media.size_bytes == 1024
    assert media.sha256 == "c" * 64
    assert media.object_key == storage.upload_object_key(participant.id, entry_id, media.id)

    url = urlsplit(body["upload_url"])
    assert f"{url.scheme}://{url.netloc}" == "http://127.0.0.1:8080"
    assert url.path == f"/media/{media.object_key}"
    query = parse_qs(url.query)
    assert query["X-Amz-Expires"] == ["600"]
    signed_headers = query["X-Amz-SignedHeaders"][0]
    assert "content-type" in signed_headers
    assert "content-length" in signed_headers
    assert query["X-Amz-Signature"][0]

    expires_at = datetime.fromisoformat(body["expires_at"])
    assert timedelta(minutes=9) < expires_at - datetime.now(UTC) <= timedelta(minutes=10)

    audit = session.scalars(
        select(AuditLog).where(AuditLog.action == "media_upload_url_issued")
    ).one()
    assert audit.actor_id == participant.id
    assert audit.target == str(media.id)


@pytest.mark.parametrize(
    ("mime_type", "size_bytes", "code"),
    [
        ("application/pdf", 1024, "unsupported_media_type"),
        ("image/svg+xml", 1024, "unsupported_media_type"),
        ("image/jpeg", 26 * 1024 * 1024, "media_too_large"),
    ],
)
def test_upload_url_refuses_unsupported_types_and_sizes(
    client: TestClient,
    session: Session,
    participant: Participant,
    mime_type: str,
    size_bytes: int,
    code: str,
) -> None:
    response = client.post(
        UPLOAD_URL,
        headers=device_headers(),
        json=upload_payload(mime_type=mime_type, size_bytes=size_bytes),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
    assert session.scalar(select(func.count()).select_from(MediaObject)) == 0


def test_upload_url_requires_an_active_participant(
    client: TestClient, session: Session, participant: Participant
) -> None:
    participant.status = ParticipantStatus.PENDING_APPROVAL
    session.commit()

    response = client.post(UPLOAD_URL, headers=device_headers(), json=upload_payload())

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "participant_not_active"
    assert session.scalar(select(func.count()).select_from(MediaObject)) == 0


def test_upload_url_requires_a_device_token(client: TestClient) -> None:
    response = client.post(UPLOAD_URL, json=upload_payload())

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_submit_entry_marks_the_prompt_answered_and_writes_the_outbox(
    client: TestClient,
    session: Session,
    participant: Participant,
    activity: Activity,
    make_prompt,
) -> None:
    prompt = make_prompt(participant, activity)
    payload = entry_payload(activity, prompt_id=str(prompt.id))

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == payload["id"]
    assert body["duplicate"] is False
    assert body["received_at"]

    entry = session.get(Entry, uuid.UUID(str(payload["id"])))
    assert entry is not None
    assert entry.participant_id == participant.id
    assert entry.prompt_id == prompt.id
    assert entry.activity_id == activity.id
    assert entry.body == "A note"
    assert entry.content_sha256 == SHA_A
    assert entry.recorded_at == datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
    assert entry.received_at is not None

    session.refresh(prompt)
    assert prompt.status == PromptStatus.ANSWERED

    events = session.scalars(select(OutboxEvent).order_by(OutboxEvent.id)).all()
    assert [event.event_type for event in events] == ["entry.created"]
    event_payload = events[0].payload
    assert event_payload["entry_id"] == payload["id"]
    assert event_payload["participant_id"] == str(participant.id)
    assert event_payload["study_id"] == str(participant.study_id)
    assert event_payload["entry_type"] == "text"
    assert event_payload["recorded_at"] == "2026-11-01T10:00:00+00:00"

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "entry_created")).one()
    assert audit.actor_id == participant.id
    assert audit.target == payload["id"]


def test_media_entry_links_files_and_enqueues_processing(
    client: TestClient,
    session: Session,
    monkeypatch,
    participant: Participant,
    make_activity,
    make_prompt,
    make_media,
) -> None:
    activity = make_activity(("photo",))
    prompt = make_prompt(participant, activity)
    entry_id = uuid.uuid4()
    media = make_media(entry_id)
    monkeypatch.setattr(storage, "object_exists", lambda _key: True)
    payload = entry_payload(
        activity,
        id=str(entry_id),
        entry_type="photo",
        prompt_id=str(prompt.id),
        body=None,
        media_object_ids=[str(media.id)],
    )

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 200
    session.refresh(media)
    assert media.entry_id == entry_id
    assert media.status == MediaStatus.UPLOADED

    events = session.scalars(select(OutboxEvent).order_by(OutboxEvent.id)).all()
    assert [event.event_type for event in events] == ["media.process", "entry.created"]
    media_event = events[0].payload
    assert media_event == {
        "media_object_id": str(media.id),
        "object_key": media.object_key,
        "mime_type": "image/jpeg",
    }


def test_resend_with_the_same_id_and_hash_returns_200_without_new_events(
    client: TestClient,
    session: Session,
    participant: Participant,
    activity: Activity,
) -> None:
    payload = entry_payload(activity)

    first = client.post(ENTRIES, headers=device_headers(), json=payload)
    second = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert first.status_code == 200
    assert first.json()["duplicate"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert session.scalar(select(func.count()).select_from(Entry)) == 1
    assert session.scalar(select(func.count()).select_from(OutboxEvent)) == 1


def test_resend_with_a_different_hash_returns_409(
    client: TestClient,
    session: Session,
    participant: Participant,
    activity: Activity,
) -> None:
    payload = entry_payload(activity)
    client.post(ENTRIES, headers=device_headers(), json=payload)

    conflict = client.post(
        ENTRIES,
        headers=device_headers(),
        json={**payload, "content_sha256": "d" * 64},
    )

    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "entry_conflict"
    entry = session.get(Entry, uuid.UUID(str(payload["id"])))
    assert entry is not None
    assert entry.content_sha256 == SHA_A


def test_another_participant_reusing_the_id_gets_409(
    client: TestClient,
    session: Session,
    study,
    participant: Participant,
    make_participant,
    activity: Activity,
) -> None:
    other = make_participant(study, device_token="another-device-token", alias="P02")
    payload = entry_payload(activity)
    client.post(ENTRIES, headers=device_headers(), json=payload)

    response = client.post(ENTRIES, headers=device_headers("another-device-token"), json=payload)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "entry_conflict"
    assert other.id != participant.id


@pytest.mark.parametrize(
    "status",
    [
        ParticipantStatus.PENDING_APPROVAL,
        ParticipantStatus.WITHDRAWN,
        ParticipantStatus.ERASURE_SCHEDULED,
    ],
)
def test_entry_is_refused_for_a_non_active_participant(
    client: TestClient,
    session: Session,
    participant: Participant,
    activity: Activity,
    status: ParticipantStatus,
) -> None:
    participant.status = status
    session.commit()

    response = client.post(ENTRIES, headers=device_headers(), json=entry_payload(activity))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "participant_not_active"
    assert session.scalar(select(func.count()).select_from(Entry)) == 0
    assert session.scalar(select(func.count()).select_from(OutboxEvent)) == 0


def test_entry_type_must_be_accepted_by_the_activity(
    client: TestClient, participant: Participant, activity: Activity
) -> None:
    response = client.post(
        ENTRIES,
        headers=device_headers(),
        json=entry_payload(activity, entry_type="photo", media_object_ids=[str(uuid.uuid4())]),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "entry_type_not_allowed"


def test_location_is_refused_when_the_activity_does_not_request_it(
    client: TestClient,
    session: Session,
    participant: Participant,
    make_activity,
) -> None:
    activity = make_activity(("text",))
    payload = entry_payload(activity, latitude=38.7, longitude=-9.1)

    refused = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "location_not_requested"
    assert session.scalar(select(func.count()).select_from(Entry)) == 0


def test_location_is_stored_when_the_activity_requests_it(
    client: TestClient,
    session: Session,
    participant: Participant,
    make_activity,
) -> None:
    activity = make_activity(("text",), capture_location=True)
    payload = entry_payload(activity, latitude=38.7, longitude=-9.1)

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 200
    entry = session.get(Entry, uuid.UUID(str(payload["id"])))
    assert entry is not None
    assert entry.latitude == 38.7
    assert entry.longitude == -9.1


def test_entry_is_refused_when_the_media_file_was_not_uploaded(
    client: TestClient,
    session: Session,
    monkeypatch,
    participant: Participant,
    make_activity,
    make_media,
) -> None:
    activity = make_activity(("photo",))
    entry_id = uuid.uuid4()
    media = make_media(entry_id)
    monkeypatch.setattr(storage, "object_exists", lambda _key: False)
    payload = entry_payload(
        activity,
        id=str(entry_id),
        entry_type="photo",
        body=None,
        media_object_ids=[str(media.id)],
    )

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "media_not_uploaded"
    assert session.scalar(select(func.count()).select_from(Entry)) == 0
    assert session.scalar(select(func.count()).select_from(OutboxEvent)) == 0
    session.refresh(media)
    assert media.entry_id is None
    assert media.status == MediaStatus.PENDING


def test_media_of_another_participant_cannot_be_attached(
    client: TestClient,
    session: Session,
    monkeypatch,
    study,
    participant: Participant,
    make_participant,
    make_activity,
    make_media,
) -> None:
    other = make_participant(study, device_token="another-device-token", alias="P02")
    activity = make_activity(("photo",))
    entry_id = uuid.uuid4()
    media = make_media(entry_id, owner=other)
    monkeypatch.setattr(storage, "object_exists", lambda _key: True)
    payload = entry_payload(
        activity,
        id=str(entry_id),
        entry_type="photo",
        body=None,
        media_object_ids=[str(media.id)],
    )

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "media_object_not_found"
    assert session.scalar(select(func.count()).select_from(Entry)) == 0


def test_scale_entry_keeps_the_scale_as_shown(
    client: TestClient,
    session: Session,
    participant: Participant,
    make_activity,
) -> None:
    scale = {
        "scale_type": "numbers",
        "points": 5,
        "low_label": "Not at all",
        "high_label": "Very much",
    }
    activity = make_activity(("scale",), options=scale)
    payload = entry_payload(activity, entry_type="scale", body=None, value=4, scale_shown=scale)

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 200
    entry = session.get(Entry, uuid.UUID(str(payload["id"])))
    assert entry is not None
    assert entry.value == 4
    assert entry.scale_shown == scale


def test_eleven_point_numbers_scale_accepts_zero(
    client: TestClient,
    session: Session,
    participant: Participant,
    make_activity,
) -> None:
    scale = {"scale_type": "numbers", "points": 11, "low_label": "None", "high_label": "A lot"}
    activity = make_activity(("scale",), options=scale)
    payload = entry_payload(activity, entry_type="scale", body=None, value=0, scale_shown=scale)

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 200
    entry = session.get(Entry, uuid.UUID(str(payload["id"])))
    assert entry is not None
    assert entry.value == 0


def test_scale_value_must_fit_the_scale(
    client: TestClient, participant: Participant, make_activity
) -> None:
    scale = {"scale_type": "numbers", "points": 5, "low_label": "Low", "high_label": "High"}
    activity = make_activity(("scale",), options=scale)
    payload = entry_payload(activity, entry_type="scale", body=None, value=9, scale_shown=scale)

    response = client.post(ENTRIES, headers=device_headers(), json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "scale_value_out_of_range"


def test_prompt_of_another_participant_is_refused(
    client: TestClient,
    study,
    participant: Participant,
    make_participant,
    activity: Activity,
    make_prompt,
) -> None:
    other = make_participant(study, device_token="another-device-token", alias="P02")
    prompt = make_prompt(other, activity)

    response = client.post(
        ENTRIES,
        headers=device_headers(),
        json=entry_payload(activity, prompt_id=str(prompt.id)),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "prompt_not_found"


def test_free_entries_respect_the_daily_cap(
    client: TestClient,
    participant: Participant,
    make_activity,
) -> None:
    activity = make_activity(
        ("text",),
        allow_free_entries=True,
        max_free_entries_per_day=1,
    )

    accepted = client.post(ENTRIES, headers=device_headers(), json=entry_payload(activity))
    refused = client.post(ENTRIES, headers=device_headers(), json=entry_payload(activity))

    assert accepted.status_code == 200
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "free_entry_limit_reached"


def test_free_entries_are_refused_when_the_activity_does_not_allow_them(
    client: TestClient, participant: Participant, make_activity
) -> None:
    activity = make_activity(("text",), allow_free_entries=False)

    response = client.post(ENTRIES, headers=device_headers(), json=entry_payload(activity))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "free_entries_not_allowed"
