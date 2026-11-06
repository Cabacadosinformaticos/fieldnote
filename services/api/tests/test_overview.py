from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Activity, Entry, Participant, Prompt, Study, StudyMember, UserAccount
from app.models.enums import (
    EntryType,
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    UnplannedReason,
    UserRole,
)


def _add_member(session: Session, study: Study, user: UserAccount) -> None:
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=StudyRole.MEMBER))
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


def _make_prompt(
    session: Session,
    participant: Participant,
    activity: Activity,
    *,
    plan_date,
    occurrence: int,
    status: PromptStatus,
    unplanned_reason: UnplannedReason | None = None,
    shown_at: datetime | None = None,
    opened_at: datetime | None = None,
) -> Prompt:
    prompt = Prompt(
        participant_id=participant.id,
        activity_id=activity.id,
        plan_date=plan_date,
        occurrence=occurrence,
        status=status,
        unplanned_reason=unplanned_reason,
        shown_at=shown_at,
        opened_at=opened_at,
    )
    session.add(prompt)
    session.commit()
    return prompt


def _make_entry(
    session: Session,
    participant: Participant,
    activity: Activity,
    *,
    recorded_at: datetime,
    prompt_id=None,
) -> Entry:
    entry = Entry(
        participant_id=participant.id,
        prompt_id=prompt_id,
        activity_id=activity.id,
        entry_type=EntryType.TEXT,
        content_sha256="a" * 64,
        recorded_at=recorded_at,
        received_at=recorded_at,
        body="A note",
    )
    session.add(entry)
    session.commit()
    return entry


def test_overview_counts_entries_adherence_and_alerts(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    activity = _make_activity(session, study)

    participants = {}
    for alias, status in (
        ("P01", ParticipantStatus.ACTIVE),
        ("P02", ParticipantStatus.PENDING_APPROVAL),
        ("P03", ParticipantStatus.ACTIVE),
        ("P04", ParticipantStatus.ACTIVE),
        ("P05", ParticipantStatus.DECLINED),
        ("P06", ParticipantStatus.WITHDRAWN),
        ("P07", ParticipantStatus.REMOVED),
        ("P08", ParticipantStatus.ERASURE_SCHEDULED),
    ):
        participant = make_participant(study, alias=alias)
        participant.status = status
        session.commit()
        participants[alias] = participant

    now = datetime.now(UTC)
    today_local = now.astimezone(ZoneInfo("Europe/Lisbon")).date()
    yesterday = today_local - timedelta(days=1)

    answered_today = _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=today_local,
        occurrence=0,
        status=PromptStatus.ANSWERED,
        shown_at=now,
        opened_at=now,
    )
    _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=today_local,
        occurrence=1,
        status=PromptStatus.SENT,
        shown_at=now,
    )
    _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=today_local,
        occurrence=2,
        status=PromptStatus.EXPIRED,
    )
    _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=today_local,
        occurrence=3,
        status=PromptStatus.PLANNED,
    )
    _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=today_local,
        occurrence=4,
        status=PromptStatus.UNPLANNED,
        unplanned_reason=UnplannedReason.DAILY_CAP,
    )
    answered_yesterday = _make_prompt(
        session,
        participants["P01"],
        activity,
        plan_date=yesterday,
        occurrence=0,
        status=PromptStatus.ANSWERED,
        shown_at=now - timedelta(days=1),
        opened_at=now - timedelta(days=1),
    )
    _make_prompt(
        session,
        participants["P02"],
        activity,
        plan_date=today_local,
        occurrence=0,
        status=PromptStatus.ANSWERED,
        shown_at=now,
        opened_at=now,
    )

    newest = _make_entry(
        session,
        participants["P01"],
        activity,
        recorded_at=now,
        prompt_id=answered_today.id,
    )
    yesterday_entry = _make_entry(
        session,
        participants["P01"],
        activity,
        recorded_at=now - timedelta(days=1),
        prompt_id=answered_yesterday.id,
    )
    _make_entry(
        session,
        participants["P03"],
        activity,
        recorded_at=now - timedelta(days=3),
    )
    withdrawn_entry = _make_entry(
        session,
        participants["P06"],
        activity,
        recorded_at=now,
    )
    _make_entry(
        session,
        participants["P07"],
        activity,
        recorded_at=now - timedelta(days=10),
    )
    _make_entry(session, participants["P02"], activity, recorded_at=now)
    _make_entry(
        session,
        participants["P05"],
        activity,
        recorded_at=now - timedelta(days=4),
    )
    _make_entry(session, participants["P08"], activity, recorded_at=now)

    response = client.get(f"/api/v1/studies/{study.id}/overview", headers=bearer_headers(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["date"] == today_local.isoformat()
    assert body["timezone"] == "Europe/Lisbon"
    assert body["participants"] == {
        "total": 7,
        "active": 3,
        "pending_approval": 1,
        "declined": 1,
        "withdrawn": 1,
        "removed": 1,
    }
    assert body["entries"] == {
        "total": 5,
        "today": 2,
        "today_answered": 1,
        "today_free": 1,
    }
    assert body["adherence_today"] == {
        "answered": 1,
        "sent": 1,
        "shown": 2,
        "opened": 1,
        "expired": 1,
        "planned": 1,
        "percentage": 33.3,
    }
    assert body["adherence_study"] == {
        "answered": 2,
        "sent": 1,
        "shown": 3,
        "opened": 2,
        "expired": 1,
        "planned": 1,
        "percentage": 50.0,
    }

    assert len(body["last_entries"]) == 5
    assert {item["id"] for item in body["last_entries"][:2]} == {
        str(newest.id),
        str(withdrawn_entry.id),
    }
    assert body["last_entries"][2]["id"] == str(yesterday_entry.id)
    assert body["last_entries"][0]["participant_alias"] in {"P01", "P06"}
    assert body["last_entries"][0]["activity_title"] == "Walk"
    stamps = [item["recorded_at"] for item in body["last_entries"]]
    assert stamps == sorted(stamps, reverse=True)

    alerts = {(alert["kind"], alert["alias"]) for alert in body["alerts"]}
    assert alerts == {
        ("pending_approval", "P02"),
        ("no_entries", "P03"),
        ("no_entries", "P04"),
    }
    no_entries = {
        alert["alias"]: alert for alert in body["alerts"] if alert["kind"] == "no_entries"
    }
    assert no_entries["P03"]["last_entry_at"] is not None
    assert no_entries["P04"]["last_entry_at"] is None


def test_overview_requires_membership(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, member)

    url = f"/api/v1/studies/{study.id}/overview"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403
    assert client.get(url, headers=bearer_headers(member)).status_code == 200
    assert client.get(url, headers=bearer_headers(admin)).status_code == 200
    missing = client.get(
        "/api/v1/studies/00000000-0000-0000-0000-000000000000/overview",
        headers=bearer_headers(admin),
    )
    assert missing.status_code == 404
