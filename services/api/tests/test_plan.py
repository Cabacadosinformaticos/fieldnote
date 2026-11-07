from datetime import UTC, date, datetime, time

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    Availability,
    Participant,
    PlanRun,
    Prompt,
    Study,
    StudyMember,
    UserAccount,
)
from app.models.enums import (
    EntryType,
    ParticipantStatus,
    PromptStatus,
    StudyRole,
    UnplannedReason,
    UserRole,
)

MONDAY = date(2026, 1, 5)


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
    occurrence: int,
    status: PromptStatus,
    plan_date: date = MONDAY,
    scheduled_at: datetime | None = None,
    unplanned_reason: UnplannedReason | None = None,
) -> Prompt:
    prompt = Prompt(
        participant_id=participant.id,
        activity_id=activity.id,
        plan_date=plan_date,
        occurrence=occurrence,
        scheduled_at=scheduled_at,
        status=status,
        unplanned_reason=unplanned_reason,
    )
    session.add(prompt)
    session.commit()
    return prompt


def test_plan_lists_the_day_prompts_and_the_weekday_availability(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    participant = make_participant(study, alias="P01")
    activity = _make_activity(session, study)

    session.add_all(
        [
            Availability(
                participant_id=participant.id,
                start_time=time(8, 0),
                end_time=time(12, 0),
                weekdays=[1, 3],
            ),
            Availability(
                participant_id=participant.id,
                start_time=time(14, 0),
                end_time=time(18, 0),
                weekdays=[2],
            ),
        ]
    )
    session.commit()

    planned = _make_prompt(
        session,
        participant,
        activity,
        occurrence=0,
        status=PromptStatus.PLANNED,
        scheduled_at=datetime(2026, 1, 5, 9, 0, tzinfo=UTC),
    )
    unplanned = _make_prompt(
        session,
        participant,
        activity,
        occurrence=1,
        status=PromptStatus.UNPLANNED,
        unplanned_reason=UnplannedReason.OUTSIDE_AVAILABILITY,
    )
    _make_prompt(
        session,
        participant,
        activity,
        occurrence=0,
        status=PromptStatus.PLANNED,
        plan_date=date(2026, 1, 6),
        scheduled_at=datetime(2026, 1, 6, 9, 0, tzinfo=UTC),
    )

    response = client.get(
        f"/api/v1/studies/{study.id}/plan",
        params={"date": "2026-01-05"},
        headers=bearer_headers(user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["date"] == "2026-01-05"
    assert body["weekday"] == 1
    assert len(body["participants"]) == 1
    person = body["participants"][0]
    assert person["participant_id"] == str(participant.id)
    assert person["alias"] == "P01"
    assert person["active"] is True
    assert person["availability_any_time"] is False
    assert person["availability"] == [{"start_time": "08:00:00", "end_time": "12:00:00"}]

    assert [prompt["prompt_id"] for prompt in body["prompts"]] == [
        str(planned.id),
        str(unplanned.id),
    ]
    first = body["prompts"][0]
    assert first["participant_alias"] == "P01"
    assert first["activity_title"] == "Walk"
    assert first["scheduled_at"] == "2026-01-05T09:00:00Z"
    assert first["status"] == "planned"
    assert first["unplanned_reason"] is None
    second = body["prompts"][1]
    assert second["scheduled_at"] is None
    assert second["status"] == "unplanned"
    assert second["unplanned_reason"] == "outside_availability"
    assert body["run"] is None


def test_plan_flags_who_is_active_and_reports_the_day_plan_run(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    active = make_participant(study, alias="P01")
    withdrawn = make_participant(study, alias="P02")
    withdrawn.status = ParticipantStatus.WITHDRAWN
    session.commit()
    activity = _make_activity(session, study)
    _make_prompt(session, active, activity, occurrence=0, status=PromptStatus.PLANNED)
    _make_prompt(session, withdrawn, activity, occurrence=0, status=PromptStatus.UNPLANNED)

    # A replan only adds a few prompts; the day plan is the run that planned the most.
    session.add_all(
        [
            PlanRun(
                study_id=study.id,
                plan_date=MONDAY,
                finished=True,
                nodes_expanded=12,
                planned=2,
                unplanned=0,
                solve_ms=420,
            ),
            PlanRun(
                study_id=study.id,
                plan_date=MONDAY,
                finished=True,
                nodes_expanded=2,
                planned=0,
                unplanned=1,
                solve_ms=5,
            ),
        ]
    )
    session.commit()

    response = client.get(
        f"/api/v1/studies/{study.id}/plan",
        params={"date": MONDAY.isoformat()},
        headers=bearer_headers(user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    # The page keeps the prompts of people who left so the overview matrix keeps their history.
    assert {person["alias"]: person["active"] for person in body["participants"]} == {
        "P01": True,
        "P02": False,
    }
    assert {prompt["participant_alias"] for prompt in body["prompts"]} == {"P01", "P02"}
    assert body["run"].pop("created_at")
    assert body["run"] == {
        "finished": True,
        "nodes_expanded": 12,
        "planned": 2,
        "unplanned": 0,
        "solve_ms": 420,
    }


def test_plan_reports_any_time_and_hides_other_states(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    any_time = make_participant(study, alias="P01")
    any_time.availability_any_time = True
    hidden = make_participant(study, alias="P02")
    hidden.status = ParticipantStatus.PENDING_APPROVAL
    session.commit()
    activity = _make_activity(session, study)
    _make_prompt(session, any_time, activity, occurrence=0, status=PromptStatus.SENT)
    _make_prompt(session, hidden, activity, occurrence=0, status=PromptStatus.SENT)

    response = client.get(
        f"/api/v1/studies/{study.id}/plan",
        params={"date": MONDAY.isoformat()},
        headers=bearer_headers(user),
    )

    assert response.status_code == 200
    body = response.json()
    assert [person["alias"] for person in body["participants"]] == ["P01"]
    assert body["participants"][0]["availability_any_time"] is True
    assert body["participants"][0]["availability"] == []
    assert {prompt["participant_alias"] for prompt in body["prompts"]} == {"P01"}


def test_plan_requires_membership_and_a_valid_date(
    client: TestClient, session: Session, make_user, make_study, make_participant, bearer_headers
) -> None:
    study = make_study()
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, member)
    make_participant(study)

    url = f"/api/v1/studies/{study.id}/plan"
    assert client.get(url, params={"date": MONDAY.isoformat()}).status_code == 401
    assert (
        client.get(
            url, params={"date": MONDAY.isoformat()}, headers=bearer_headers(outsider)
        ).status_code
        == 403
    )
    assert (
        client.get(
            url, params={"date": MONDAY.isoformat()}, headers=bearer_headers(member)
        ).status_code
        == 200
    )
    assert (
        client.get(
            url, params={"date": MONDAY.isoformat()}, headers=bearer_headers(admin)
        ).status_code
        == 200
    )
    assert client.get(url, headers=bearer_headers(member)).status_code == 422
    bad = client.get(url, params={"date": "05-01-2026"}, headers=bearer_headers(member))
    assert bad.status_code == 422
    missing = client.get(
        "/api/v1/studies/00000000-0000-0000-0000-000000000000/plan",
        params={"date": MONDAY.isoformat()},
        headers=bearer_headers(admin),
    )
    assert missing.status_code == 404
