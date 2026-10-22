from datetime import UTC, datetime, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Activity, Entry, Participant, Prompt, Study, StudyMember, UserAccount
from app.models.enums import EntryType, ParticipantStatus, PromptStatus, StudyRole
from app.routers import events as events_router


def _add_member(session: Session, study: Study, user: UserAccount, role=StudyRole.MEMBER) -> None:
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _make_activity(session: Session, study: Study) -> Activity:
    activity = Activity(
        study_id=study.id,
        title="Walk",
        entry_types=[EntryType.TEXT.value],
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
    session: Session, participant: Participant, activity: Activity, received_at: datetime
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        activity_id=activity.id,
        entry_type=EntryType.TEXT,
        content_sha256="a" * 64,
        recorded_at=received_at - timedelta(seconds=5),
        received_at=received_at,
        body="A note",
    )
    session.add(entry)
    session.commit()
    return entry


def test_events_require_membership(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    outsider = make_user()

    url = f"/api/v1/studies/{study.id}/events"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403


def test_stream_sends_existing_events_and_an_sse_comment(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    monkeypatch.setattr(events_router, "POLL_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(events_router, "COMMENT_INTERVAL_SECONDS", 0.01)

    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    received_at = datetime.now(UTC) - timedelta(minutes=1)
    entry = _make_entry(session, participant, activity, received_at)

    since = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    lines: list[str] = []
    with client.stream(
        "GET",
        f"/api/v1/studies/{study.id}/events",
        params={"since": since},
        headers=bearer_headers(user),
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["cache-control"] == "no-store"
        for line in response.iter_lines():
            lines.append(line)
            text = "\n".join(lines)
            if (
                "event: entry.created" in text
                and "event: participant.created" in text
                and any(item.startswith(": keep-alive") for item in lines)
            ):
                break

    text = "\n".join(lines)
    assert ": connected" in text
    assert ": keep-alive" in text
    assert "event: entry.created" in text
    assert str(entry.id) in text
    assert str(participant.id) in text
    assert "event: participant.created" in text


def test_participant_state_changes_are_reported(
    session: Session, make_study, make_participant
) -> None:
    study = make_study()
    participant = make_participant(study, alias="P01")
    previous = {row.id: row.status for row in events_router._participant_rows(session, study.id)}

    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    session.commit()
    changes, current = events_router._participant_changes(session, study.id, previous)

    assert len(changes) == 1
    event, payload = changes[0]
    assert event == "participant.updated"
    assert payload["participant_id"] == participant.id
    assert payload["alias"] == "P01"
    assert payload["status"] == ParticipantStatus.ERASURE_SCHEDULED
    assert current[participant.id] == ParticipantStatus.ERASURE_SCHEDULED

    again, _ = events_router._participant_changes(session, study.id, current)
    assert again == []


def test_new_participants_are_reported(session: Session, make_study, make_participant) -> None:
    study = make_study()
    make_participant(study, alias="P01")
    previous = {row.id: row.status for row in events_router._participant_rows(session, study.id)}

    make_participant(study, alias="P02")
    changes, _ = events_router._participant_changes(session, study.id, previous)

    assert len(changes) == 1
    assert changes[0][0] == "participant.created"
    assert changes[0][1]["alias"] == "P02"


def test_entries_of_a_participant_with_a_scheduled_erasure_are_not_streamed(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    monkeypatch.setattr(events_router, "POLL_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(events_router, "COMMENT_INTERVAL_SECONDS", 0.01)

    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study, alias="P01")
    participant.status = ParticipantStatus.ERASURE_SCHEDULED
    session.commit()
    activity = _make_activity(session, study)
    entry = _make_entry(session, participant, activity, datetime.now(UTC) - timedelta(minutes=1))

    lines: list[str] = []
    with client.stream(
        "GET",
        f"/api/v1/studies/{study.id}/events",
        params={"since": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
        headers=bearer_headers(user),
    ) as response:
        for line in response.iter_lines():
            lines.append(line)
            if any(item.startswith(": keep-alive") for item in lines):
                break

    assert str(entry.id) not in "\n".join(lines)
    assert "event: entry.created" not in "\n".join(lines)


def test_unanswered_prompts_do_not_produce_entry_events(
    client: TestClient,
    session: Session,
    make_user,
    make_study,
    make_participant,
    bearer_headers,
    monkeypatch,
) -> None:
    monkeypatch.setattr(events_router, "POLL_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(events_router, "COMMENT_INTERVAL_SECONDS", 0.01)

    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)
    session.add(
        Prompt(
            participant_id=participant.id,
            activity_id=activity.id,
            plan_date=datetime.now(UTC).date(),
            occurrence=0,
            scheduled_at=datetime.now(UTC),
            status=PromptStatus.SENT,
        )
    )
    session.commit()

    lines: list[str] = []
    with client.stream(
        "GET",
        f"/api/v1/studies/{study.id}/events",
        params={"since": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
        headers=bearer_headers(user),
    ) as response:
        for line in response.iter_lines():
            lines.append(line)
            if any(item.startswith(": keep-alive") for item in lines):
                break

    assert "event: entry.created" not in "\n".join(lines)
