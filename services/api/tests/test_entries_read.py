from datetime import UTC, date, datetime, time, timedelta

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
    Prompt,
    Study,
    Tag,
    UserAccount,
)
from app.models.enums import (
    EntryType,
    MediaStatus,
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    UserRole,
)


def _add_member(session: Session, study: Study, user: UserAccount, role=StudyRole.MEMBER) -> None:
    from app.models import StudyMember

    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _make_activity(session: Session, study: Study, title: str = "Walk") -> Activity:
    activity = Activity(
        study_id=study.id,
        title=title,
        entry_types=[EntryType.TEXT.value, EntryType.SCALE.value, EntryType.PHOTO.value],
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
    activity: Activity | None,
    entry_type: EntryType = EntryType.TEXT,
    *,
    recorded_at: datetime,
    body: str | None = "A note",
    value: int | None = None,
    scale_shown: dict[str, object] | None = None,
    choice: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        activity_id=activity.id if activity is not None else None,
        entry_type=entry_type,
        content_sha256="a" * 64,
        recorded_at=recorded_at,
        received_at=recorded_at + timedelta(seconds=5),
        body=body,
        value=value,
        scale_shown=scale_shown,
        choice=choice,
        latitude=latitude,
        longitude=longitude,
    )
    session.add(entry)
    session.commit()
    return entry


def _make_prompt(
    session: Session,
    participant: Participant,
    activity: Activity,
    *,
    plan_date: date,
    occurrence: int,
    status: PromptStatus,
    scheduled_at: datetime | None = None,
) -> Prompt:
    prompt = Prompt(
        participant_id=participant.id,
        activity_id=activity.id,
        plan_date=plan_date,
        occurrence=occurrence,
        scheduled_at=scheduled_at,
        status=status,
    )
    session.add(prompt)
    session.commit()
    return prompt


BASE = datetime(2026, 1, 5, 9, 0, tzinfo=UTC)


def test_list_entries_filters_and_cursor_pagination(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    first = make_participant(study, alias="P01")
    second = make_participant(study, alias="P02")
    walk = _make_activity(session, study, "Walk")
    sleep = _make_activity(session, study, "Sleep")

    tag = Tag(study_id=study.id, name="morning")
    session.add(tag)
    session.commit()

    one = _make_entry(session, first, walk, recorded_at=BASE + timedelta(hours=1))
    two = _make_entry(
        session,
        first,
        sleep,
        EntryType.SCALE,
        recorded_at=BASE + timedelta(hours=2),
        body=None,
        value=4,
        scale_shown={"scale_type": "numbers", "points": 5},
    )
    three = _make_entry(
        session, second, walk, EntryType.PHOTO, recorded_at=BASE + timedelta(hours=3), body=None
    )
    four = _make_entry(
        session, second, sleep, recorded_at=BASE + timedelta(hours=4), body="Another note"
    )
    session.add(EntryTag(entry_id=one.id, tag_id=tag.id))
    session.commit()

    headers = bearer_headers(user)
    url = f"/api/v1/studies/{study.id}/entries"

    first_page = client.get(url, params={"limit": 2}, headers=headers)
    assert first_page.status_code == 200
    body = first_page.json()
    assert [item["id"] for item in body["items"]] == [str(four.id), str(three.id)]
    assert body["next_cursor"]

    second_page = client.get(
        url, params={"limit": 2, "cursor": body["next_cursor"]}, headers=headers
    )
    assert second_page.status_code == 200
    second_body = second_page.json()
    assert [item["id"] for item in second_body["items"]] == [str(two.id), str(one.id)]
    assert second_body["next_cursor"] is None

    listed = next(item for item in body["items"] if item["id"] == str(three.id))
    assert listed["participant_alias"] == "P02"
    assert listed["recorded_at"]
    assert listed["received_at"]
    assert listed["media"] == []

    by_participant = client.get(url, params={"participant_id": str(first.id)}, headers=headers)
    assert {item["id"] for item in by_participant.json()["items"]} == {str(one.id), str(two.id)}

    by_activity = client.get(url, params={"activity_id": str(walk.id)}, headers=headers)
    assert {item["id"] for item in by_activity.json()["items"]} == {str(one.id), str(three.id)}

    by_type = client.get(url, params={"entry_type": "text"}, headers=headers)
    assert {item["id"] for item in by_type.json()["items"]} == {str(one.id), str(four.id)}

    by_tag = client.get(url, params={"tag_id": str(tag.id)}, headers=headers)
    assert [item["id"] for item in by_tag.json()["items"]] == [str(one.id)]

    by_date = client.get(
        url,
        params={
            "date_from": (BASE + timedelta(hours=1, minutes=30)).isoformat(),
            "date_to": (BASE + timedelta(hours=3, minutes=30)).isoformat(),
        },
        headers=headers,
    )
    assert {item["id"] for item in by_date.json()["items"]} == {str(two.id), str(three.id)}

    invalid = client.get(url, params={"cursor": "not-a-cursor"}, headers=headers)
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "invalid_cursor"


def test_only_visible_participant_states_appear(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    activity = _make_activity(session, study)

    statuses = {
        "active": ParticipantStatus.ACTIVE,
        "withdrawn": ParticipantStatus.WITHDRAWN,
        "removed": ParticipantStatus.REMOVED,
        "pending": ParticipantStatus.PENDING_APPROVAL,
        "declined": ParticipantStatus.DECLINED,
        "erasure": ParticipantStatus.ERASURE_SCHEDULED,
    }
    participants = {}
    for alias, status in statuses.items():
        participant = make_participant(study, alias=alias)
        participant.status = status
        session.commit()
        _make_entry(session, participant, activity, recorded_at=BASE, body=alias)
        participants[alias] = participant

    response = client.get(f"/api/v1/studies/{study.id}/entries", headers=bearer_headers(user))

    assert response.status_code == 200
    visible = {item["participant_alias"] for item in response.json()["items"]}
    assert visible == {"active", "withdrawn", "removed"}


def test_entries_require_membership_but_administrators_pass(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, member)
    make_participant(study)

    url = f"/api/v1/studies/{study.id}/entries"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403
    assert client.get(url, headers=bearer_headers(member)).status_code == 200
    assert client.get(url, headers=bearer_headers(admin)).status_code == 200


def test_entry_detail_signs_only_processed_media_and_audits_the_issue(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study)
    activity = _make_activity(session, study)
    entry = _make_entry(session, participant, activity, recorded_at=BASE)

    processed = MediaObject(
        entry_id=entry.id,
        object_key=f"studies/{study.id}/photo.jpg",
        mime_type="image/jpeg",
        size_bytes=1024,
        sha256="b" * 64,
        status=MediaStatus.PROCESSED,
    )
    failed = MediaObject(
        entry_id=entry.id,
        object_key=f"studies/{study.id}/failed.jpg",
        mime_type="image/jpeg",
        size_bytes=512,
        sha256="c" * 64,
        status=MediaStatus.FAILED,
    )
    session.add_all([processed, failed])
    session.commit()

    response = client.get(
        f"/api/v1/studies/{study.id}/entries/{entry.id}", headers=bearer_headers(user)
    )

    assert response.status_code == 200
    body = response.json()
    media = {item["id"]: item for item in body["media"]}
    signed = media[str(processed.id)]
    assert signed["url"] is not None
    assert "X-Amz-Signature=" in signed["url"]
    assert "X-Amz-Expires=600" in signed["url"]
    assert f"/studies/{study.id}/photo.jpg" in signed["url"]
    assert signed["url_expires_at"]
    assert media[str(failed.id)]["url"] is None

    audits = session.scalars(select(AuditLog).where(AuditLog.action == "media_url_issued")).all()
    assert len(audits) == 1
    assert audits[0].target == str(processed.id)
    assert audits[0].actor_id == user.id
    assert audits[0].details["object_key"] == processed.object_key


def test_entry_detail_refuses_an_entry_of_another_study(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study(title="One")
    other = make_study(title="Two")
    user = make_user()
    _add_member(session, study, user)
    _add_member(session, other, user)
    participant = make_participant(other)
    activity = _make_activity(session, other)
    entry = _make_entry(session, participant, activity, recorded_at=BASE)

    response = client.get(
        f"/api/v1/studies/{study.id}/entries/{entry.id}", headers=bearer_headers(user)
    )

    assert response.status_code == 404


def test_timeline_has_one_lane_per_participant_and_hollow_expired_markers(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    first = make_participant(study, alias="P01")
    second = make_participant(study, alias="P02")
    activity = _make_activity(session, study)
    _make_entry(session, first, activity, recorded_at=BASE + timedelta(hours=1))
    _make_entry(
        session, second, activity, EntryType.PHOTO, recorded_at=BASE + timedelta(hours=2), body=None
    )
    _make_prompt(
        session,
        first,
        activity,
        plan_date=BASE.date(),
        occurrence=0,
        status=PromptStatus.EXPIRED,
        scheduled_at=BASE,
    )
    _make_prompt(
        session,
        second,
        activity,
        plan_date=BASE.date(),
        occurrence=0,
        status=PromptStatus.PLANNED,
        scheduled_at=BASE,
    )

    url = f"/api/v1/studies/{study.id}/timeline"
    response = client.get(
        url,
        params={
            "start": (BASE - timedelta(days=1)).isoformat(),
            "end": (BASE + timedelta(days=1)).isoformat(),
            "zoom": "hours",
        },
        headers=bearer_headers(user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["zoom"] == "hours"
    assert [lane["alias"] for lane in body["lanes"]] == ["P01", "P02"]
    lanes = {lane["alias"]: lane for lane in body["lanes"]}
    assert len(lanes["P01"]["entries"]) == 1
    assert lanes["P01"]["entries"][0]["entry_type"] == "text"
    assert lanes["P01"]["markers"][0]["hollow"] is True
    assert lanes["P01"]["markers"][0]["status"] == "expired"
    assert lanes["P02"]["markers"] == []

    filtered = client.get(
        url,
        params={
            "participant_id": str(first.id),
            "start": (BASE - timedelta(days=1)).isoformat(),
            "end": (BASE + timedelta(days=1)).isoformat(),
        },
        headers=bearer_headers(user),
    )
    assert len(filtered.json()["lanes"]) == 1

    invalid_zoom = client.get(url, params={"zoom": "minute"}, headers=bearer_headers(user))
    assert invalid_zoom.status_code == 422


def test_adherence_matrix_counts_states_and_free_entries(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    study.starts_on = date(2026, 1, 5)
    study.ends_on = date(2026, 1, 6)
    session.commit()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)

    _make_prompt(
        session,
        participant,
        activity,
        plan_date=date(2026, 1, 5),
        occurrence=0,
        status=PromptStatus.ANSWERED,
        scheduled_at=BASE,
    )
    _make_prompt(
        session,
        participant,
        activity,
        plan_date=date(2026, 1, 5),
        occurrence=1,
        status=PromptStatus.EXPIRED,
        scheduled_at=BASE + timedelta(hours=2),
    )
    _make_prompt(
        session,
        participant,
        activity,
        plan_date=date(2026, 1, 6),
        occurrence=0,
        status=PromptStatus.SENT,
        scheduled_at=BASE + timedelta(days=1),
    )
    _make_prompt(
        session,
        participant,
        activity,
        plan_date=date(2026, 1, 6),
        occurrence=1,
        status=PromptStatus.PLANNED,
        scheduled_at=BASE + timedelta(days=1, hours=2),
    )
    _make_prompt(
        session,
        participant,
        activity,
        plan_date=date(2026, 1, 5),
        occurrence=2,
        status=PromptStatus.UNPLANNED,
    )
    _make_entry(
        session,
        participant,
        activity,
        recorded_at=datetime(2026, 1, 5, 12, 0, tzinfo=UTC),
    )

    response = client.get(
        f"/api/v1/studies/{study.id}/participants/{participant.id}/adherence",
        headers=bearer_headers(user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["participant"]["alias"] == "P01"
    assert body["slots"] == [0, 1]
    assert [day["date"] for day in body["days"]] == ["2026-01-05", "2026-01-06"]
    day_one = body["days"][0]
    assert day_one["free_entries"] == 1
    assert {cell["occurrence"]: cell["state"] for cell in day_one["cells"]} == {
        0: "answered",
        1: "expired",
    }
    day_two = body["days"][1]
    assert {cell["occurrence"]: cell["state"] for cell in day_two["cells"]} == {
        0: "sent_pending",
        1: "not_sent",
    }
    summary = body["summary"]
    assert summary["answered"] == 1
    assert summary["expired"] == 1
    assert summary["sent_pending"] == 1
    assert summary["not_sent"] == 1
    assert summary["denominator"] == 3
    assert summary["percentage"] == 33.3


def test_adherence_hides_a_participant_with_a_scheduled_erasure(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study)
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    session.commit()

    response = client.get(
        f"/api/v1/studies/{study.id}/participants/{participant.id}/adherence",
        headers=bearer_headers(user),
    )

    assert response.status_code == 404


def test_presign_url_changes_with_the_object_and_never_exposes_the_secret() -> None:
    from app.services.entries_read import presign_get_url

    first, first_expiry = presign_get_url("one/a.jpg")
    second, _ = presign_get_url("one/b.jpg")

    assert first != second
    assert "one/a.jpg" in first
    assert "X-Amz-Signature=" in first
    assert "X-Amz-Credential=" in first
    from app.config import settings

    assert settings.s3_secret_key not in first
    assert first_expiry > datetime.now(UTC)
