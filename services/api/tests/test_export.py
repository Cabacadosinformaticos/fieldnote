import csv
import io
import uuid
import zipfile
from datetime import UTC, datetime, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    AuditLog,
    Entry,
    EntryTag,
    MediaObject,
    Participant,
    ParticipantIdentity,
    Study,
    StudyAnswer,
    StudyQuestion,
    Tag,
    UserAccount,
)
from app.models.enums import (
    EntryType,
    MediaStatus,
    ParticipantStatus,
    QuestionKind,
    StudyRole,
    UserRole,
)
from app.services import storage


def _add_member(session: Session, study: Study, user: UserAccount, role=StudyRole.MEMBER) -> None:
    from app.models import StudyMember

    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _make_activity(session: Session, study: Study) -> Activity:
    activity = Activity(
        study_id=study.id,
        title="Morning walk",
        entry_types=[EntryType.TEXT.value, EntryType.SCALE.value],
        prompts_per_day=1,
        window_start=time(8, 0),
        window_end=time(20, 0),
        min_gap_minutes=30,
        expected_minutes=3,
    )
    session.add(activity)
    session.commit()
    return activity


def _make_entry(
    session: Session,
    participant: Participant,
    activity: Activity,
    *,
    entry_type: EntryType = EntryType.TEXT,
    body: str | None = "A note",
    value: int | None = None,
    scale_shown: dict[str, object] | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        activity_id=activity.id,
        entry_type=entry_type,
        content_sha256="a" * 64,
        recorded_at=datetime(2026, 1, 5, 9, 0, tzinfo=UTC),
        received_at=datetime(2026, 1, 5, 9, 0, 5, tzinfo=UTC),
        body=body,
        value=value,
        scale_shown=scale_shown,
        latitude=latitude,
        longitude=longitude,
    )
    session.add(entry)
    session.commit()
    return entry


_DEFAULT_MIME = {
    EntryType.PHOTO: "image/jpeg",
    EntryType.AUDIO: "audio/mp4",
    EntryType.VIDEO: "video/mp4",
}


def _make_media(
    session: Session,
    entry: Entry,
    *,
    status: MediaStatus = MediaStatus.PROCESSED,
    mime_type: str | None = None,
    object_key: str | None = None,
) -> MediaObject:
    media = MediaObject(
        entry_id=entry.id,
        object_key=object_key or f"entries/{entry.participant_id}/{entry.id}/{uuid.uuid4()}",
        mime_type=mime_type or _DEFAULT_MIME[entry.entry_type],
        size_bytes=4,
        sha256="b" * 64,
        status=status,
    )
    session.add(media)
    session.commit()
    return media


def _fake_storage(monkeypatch, objects: dict[str, bytes]) -> None:
    monkeypatch.setattr(storage, "object_exists", lambda key: key in objects)
    monkeypatch.setattr(storage, "open_object", lambda key: io.BytesIO(objects[key]))


def _rows(payload: bytes, name: str) -> tuple[list[str], list[dict[str, str]]]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        text = archive.read(name).decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader.fieldnames or []), list(reader)


def _names(payload: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        return archive.namelist()


def _export(client: TestClient, study: Study, headers: dict[str, str], **params):
    return client.get(f"/api/v1/studies/{study.id}/export", params=params, headers=headers)


def test_default_export_is_a_zip_with_entries_and_answers_and_no_identity(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    owner = make_user()
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    participant = make_participant(study, alias="P01")
    waiting = make_participant(study, alias="P02")
    waiting.status = ParticipantStatus.PENDING_APPROVAL
    session.commit()
    activity = _make_activity(session, study)

    _make_entry(session, participant, activity, body="A note")
    _make_entry(
        session,
        participant,
        activity,
        entry_type=EntryType.SCALE,
        body=None,
        value=4,
        scale_shown={
            "scale_type": "numbers",
            "points": 5,
            "label_start": "Not at all",
            "label_middle": "Somewhat",
            "label_end": "Very much",
        },
        latitude=38.7,
        longitude=-9.1,
    )
    session.add(ParticipantIdentity(participant_id=participant.id, name="Ana", email="ana@x.pt"))
    question = StudyQuestion(
        study_id=study.id, position=0, kind=QuestionKind.SHORT_TEXT, text="Why this study?"
    )
    session.add(question)
    session.commit()
    session.add_all(
        [
            StudyAnswer(
                participant_id=participant.id,
                question_id=question.id,
                question_text=question.text,
                kind=question.kind,
                answer="To help.",
            ),
            StudyAnswer(
                participant_id=waiting.id,
                question_id=question.id,
                question_text=question.text,
                kind=question.kind,
                answer="Hidden.",
            ),
        ]
    )
    session.commit()

    response = _export(client, study, bearer_headers(owner))

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["content-disposition"].startswith("attachment;")
    assert "fieldnote-export-" in response.headers["content-disposition"]

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == ["entries.csv", "study_answers.csv", "README.txt"]
        readme = archive.read("README.txt").decode("utf-8")
    assert "ordinal" in readme
    assert "no mean" in readme

    headers, entries = _rows(response.content, "entries.csv")
    assert "latitude" not in headers
    assert "longitude" not in headers
    assert "participant_name" not in headers
    assert "participant_email" not in headers
    assert "media_file" not in headers
    for column in ("scale_type", "scale_points", "scale_label_start", "scale_value"):
        assert column in headers
    assert len(entries) == 2
    assert {row["participant_alias"] for row in entries} == {"P01"}
    scale = next(row for row in entries if row["entry_type"] == "scale")
    assert scale["scale_type"] == "numbers"
    assert scale["scale_points"] == "5"
    assert scale["scale_label_start"] == "Not at all"
    assert scale["scale_label_end"] == "Very much"
    assert scale["scale_label_middle"] == "Somewhat"
    assert scale["scale_value"] == "4"
    assert "38.7" not in ",".join(scale.values())

    answer_headers, answers = _rows(response.content, "study_answers.csv")
    assert answer_headers == ["participant_alias", "question", "kind", "answer"]
    assert len(answers) == 1
    assert answers[0] == {
        "participant_alias": "P01",
        "question": "Why this study?",
        "kind": "short_text",
        "answer": "To help.",
    }

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.actor_id == owner.id
    assert audit.target == str(study.id)
    assert audit.details == {
        "format": "zip",
        "files": ["entries.csv", "study_answers.csv", "README.txt"],
        "entry_count": 2,
        "scope": "all",
        "filter": None,
        "include_location": False,
        "include_identity": False,
        "include_media": False,
        "media_types": [],
        "media_file_count": 0,
        "unavailable_media_count": 0,
        "include_csv": True,
    }


def test_location_is_added_only_when_chosen(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    _make_entry(session, participant, activity, latitude=38.7, longitude=-9.1)

    response = _export(client, study, bearer_headers(member), include_location="true")

    assert response.status_code == 200
    headers, rows = _rows(response.content, "entries.csv")
    assert "latitude" in headers
    assert "longitude" in headers
    assert rows[0]["latitude"] == "38.7"
    assert rows[0]["longitude"] == "-9.1"
    assert "participant_name" not in headers

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["include_location"] is True


def test_identity_needs_the_study_owner_or_an_administrator(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    member = make_user(email="member@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    _make_entry(session, participant, activity)
    session.add(ParticipantIdentity(participant_id=participant.id, name="Ana", email="ana@x.pt"))
    session.commit()

    refused = _export(client, study, bearer_headers(member), include_identity="true")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "forbidden"

    accepted = _export(client, study, bearer_headers(owner), include_identity="true")
    assert accepted.status_code == 200
    headers, rows = _rows(accepted.content, "entries.csv")
    assert "participant_name" in headers
    assert "participant_email" in headers
    assert rows[0]["participant_name"] == "Ana"
    assert rows[0]["participant_email"] == "ana@x.pt"

    by_admin = _export(client, study, bearer_headers(admin), include_identity="true")
    assert by_admin.status_code == 200
    assert len(_rows(by_admin.content, "entries.csv")[1]) == 1


def test_export_requires_membership(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    outsider = make_user()
    make_participant(study)

    url = f"/api/v1/studies/{study.id}/export"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403


def test_answer_file_leaves_out_erasure_scheduled_participants(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    visible = make_participant(study, alias="P01")
    erased = make_participant(study, alias="P02")
    erased.status = ParticipantStatus.ERASURE_SCHEDULED
    session.commit()
    question = StudyQuestion(study_id=study.id, position=0, kind=QuestionKind.YES_NO, text="Agree?")
    session.add(question)
    session.commit()
    for participant in (visible, erased):
        session.add(
            StudyAnswer(
                participant_id=participant.id,
                question_id=question.id,
                question_text=question.text,
                kind=question.kind,
                answer="yes",
            )
        )
    session.commit()

    response = _export(client, study, bearer_headers(member))

    assert response.status_code == 200
    _headers, answers = _rows(response.content, "study_answers.csv")
    assert [row["participant_alias"] for row in answers] == ["P01"]


@pytest.mark.parametrize(
    ("kind", "folder", "extension"),
    [
        (EntryType.PHOTO, "photo", ".jpg"),
        (EntryType.AUDIO, "audio", ".m4a"),
        (EntryType.VIDEO, "video", ".mp4"),
    ],
)
def test_one_media_type_alone(
    kind: EntryType,
    folder: str,
    extension: str,
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    entries = {}
    objects = {}
    for entry_type in (EntryType.PHOTO, EntryType.AUDIO, EntryType.VIDEO):
        entry = _make_entry(session, participant, activity, entry_type=entry_type, body=None)
        media = _make_media(session, entry)
        entries[entry_type] = entry
        objects[media.object_key] = f"{entry_type.value} bytes".encode()
    _fake_storage(monkeypatch, objects)

    response = _export(
        client,
        study,
        bearer_headers(member),
        include_media="true",
        media_type=kind.value,
    )

    assert response.status_code == 200
    names = _names(response.content)
    expected = f"media/{folder}/{entries[kind].id}{extension}"
    assert expected in names
    for other in ("photo", "audio", "video"):
        if other != folder:
            assert not any(name.startswith(f"media/{other}/") for name in names)
    assert "media/indisponiveis.csv" not in names

    headers, rows = _rows(response.content, "entries.csv")
    assert "media_file" in headers
    by_type = {row["entry_type"]: row for row in rows}
    assert by_type[kind.value]["media_file"] == expected
    assert all(
        row["media_file"] == "" for entry_type, row in by_type.items() if entry_type != kind.value
    )

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["include_media"] is True
    assert audit.details["media_types"] == [kind.value]
    assert audit.details["include_csv"] is True
    assert audit.details["media_file_count"] == 1


def test_media_only_without_csv(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    entry = _make_entry(session, participant, activity, entry_type=EntryType.PHOTO, body=None)
    media = _make_media(session, entry)
    _fake_storage(monkeypatch, {media.object_key: b"photo"})

    response = _export(
        client,
        study,
        bearer_headers(member),
        include_media="true",
        include_csv="false",
        media_type="photo",
    )

    assert response.status_code == 200
    names = _names(response.content)
    assert f"media/photo/{entry.id}.jpg" in names
    assert "entries.csv" not in names
    assert "study_answers.csv" not in names
    assert "README.txt" in names

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["include_csv"] is False
    assert audit.details["entry_count"] == 1
    assert audit.details["media_file_count"] == 1


def test_filter_scope_applies_the_entries_filter_and_the_audit_records_it(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    tagged_entry = _make_entry(
        session, participant, activity, entry_type=EntryType.PHOTO, body=None
    )
    other_entry = _make_entry(session, participant, activity, body="Not in the filter")
    tag = Tag(study_id=study.id, name="sombra")
    session.add(tag)
    session.commit()
    session.add(EntryTag(entry_id=tagged_entry.id, tag_id=tag.id))
    session.commit()
    media = _make_media(session, tagged_entry)
    _fake_storage(monkeypatch, {media.object_key: b"photo"})

    listed = client.get(
        f"/api/v1/studies/{study.id}/entries",
        params={"tag_id": str(tag.id), "limit": 1},
        headers=bearer_headers(member),
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    response = _export(
        client,
        study,
        bearer_headers(member),
        scope="filtered",
        tag_id=str(tag.id),
        include_media="true",
        media_type="photo",
    )

    assert response.status_code == 200
    _headers, rows = _rows(response.content, "entries.csv")
    assert [row["entry_id"] for row in rows] == [str(tagged_entry.id)]
    names = _names(response.content)
    assert f"media/photo/{tagged_entry.id}.jpg" in names
    assert f"media/photo/{other_entry.id}.jpg" not in names

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["scope"] == "filtered"
    assert audit.details["filter"] == {"tag_id": str(tag.id)}
    assert audit.details["entry_count"] == 1


def test_unavailable_media_is_listed_with_its_reason(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    entry = _make_entry(session, participant, activity, entry_type=EntryType.PHOTO, body=None)
    ready = _make_media(session, entry)
    processing = _make_media(session, entry, status=MediaStatus.UPLOADED)
    failed = _make_media(session, entry, status=MediaStatus.FAILED)
    missing = _make_media(session, entry)
    _fake_storage(monkeypatch, {ready.object_key: b"ready"})

    response = _export(
        client,
        study,
        bearer_headers(member),
        include_media="true",
        media_type="photo",
    )

    assert response.status_code == 200
    names = _names(response.content)
    assert f"media/photo/{entry.id}.jpg" in names
    assert "media/indisponiveis.csv" in names

    headers, rows = _rows(response.content, "media/indisponiveis.csv")
    assert headers == ["entry_id", "media_id", "tipo", "motivo"]
    assert {row["media_id"] for row in rows} == {
        str(processing.id),
        str(failed.id),
        str(missing.id),
    }
    reasons = {row["media_id"]: row["motivo"] for row in rows}
    assert reasons[str(processing.id)] == "em processamento"
    assert reasons[str(failed.id)] == "falhou"
    assert reasons[str(missing.id)] == "ficheiro em falta"

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["media_file_count"] == 1
    assert audit.details["unavailable_media_count"] == 3


def test_audit_records_the_scope_filter_media_types_and_csv_choice(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    study = make_study()
    member = make_user()
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    photo_entry = _make_entry(session, participant, activity, entry_type=EntryType.PHOTO, body=None)
    video_entry = _make_entry(session, participant, activity, entry_type=EntryType.VIDEO, body=None)
    photo = _make_media(session, photo_entry)
    video = _make_media(session, video_entry)
    _fake_storage(monkeypatch, {photo.object_key: b"photo", video.object_key: b"video"})

    response = _export(
        client,
        study,
        bearer_headers(member),
        scope="filtered",
        q="walk",
        free_only="true",
        include_media="true",
        media_type=["photo", "video"],
        include_csv="false",
    )

    assert response.status_code == 200
    audit = session.scalars(select(AuditLog).where(AuditLog.action == "export")).one()
    assert audit.details["scope"] == "filtered"
    assert audit.details["filter"] == {"q": "walk", "free_only": True}
    assert audit.details["media_types"] == ["photo", "video"]
    assert audit.details["include_csv"] is False
    assert audit.details["include_media"] is True


def test_export_history_shows_the_person_name_with_email_fallback(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    owner = make_user(email="owner@example.org")
    owner.name = "Duarte Lopes"
    member = make_user(email="member@example.org")
    _add_member(session, study, owner, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study, member)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    _make_entry(session, participant, activity)
    session.commit()

    assert _export(client, study, bearer_headers(owner)).status_code == 200
    assert (
        _export(client, study, bearer_headers(member), include_location="true").status_code == 200
    )

    response = client.get(f"/api/v1/studies/{study.id}/exports", headers=bearer_headers(member))

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 2
    assert items[0]["who"] == "member@example.org"
    assert items[0]["include_location"] is True
    assert items[1]["who"] == "Duarte Lopes"
    assert items[1]["entry_count"] == 1
    assert items[1]["include_csv"] is True
