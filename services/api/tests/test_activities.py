import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, AuditLog, Study, StudyMember, UserAccount
from app.models.enums import StudyRole, StudyStatus, UserRole

NUMBER_SCALE = {
    "scale_type": "numbers",
    "points": 5,
    "start_label": "Not at all",
    "end_label": "Very much",
}


def _payload(**overrides):
    payload = {
        "title": "Walk",
        "instructions": "Record a short walk and what you noticed.",
        "entry_types": ["text", "photo"],
        "prompts_per_day": 2,
        "window_start": "09:00:00",
        "window_end": "18:00:00",
        "min_gap_minutes": 60,
        "capture_location": False,
        "allow_free_entries": False,
        "expected_minutes": 5,
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


@pytest.fixture
def designer(session: Session, study: Study, make_user) -> UserAccount:
    designer = make_user(email="co@example.org")
    _add_member(session, study.id, designer, StudyRole.CO_INVESTIGATOR)
    return designer


@pytest.fixture
def member(session: Session, study: Study, make_user) -> UserAccount:
    member = make_user(email="member@example.org")
    _add_member(session, study.id, member, StudyRole.MEMBER)
    return member


def test_create_an_activity_with_an_entry_type_list_and_no_scale(
    client: TestClient, session: Session, study: Study, designer: UserAccount, bearer_headers
) -> None:
    response = client.post(
        f"/api/v1/studies/{study.id}/activities",
        headers=bearer_headers(designer),
        json=_payload(),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Walk"
    assert body["entry_types"] == ["text", "photo"]
    assert body["options"] is None
    assert body["prompts_per_day"] == 2
    assert body["window_start"] == "09:00:00"
    assert body["min_gap_minutes"] == 60
    assert body["expected_minutes"] == 5

    activity = session.get(Activity, uuid.UUID(body["id"]))
    assert activity is not None
    assert activity.study_id == study.id

    audit = session.scalars(select(AuditLog).where(AuditLog.action == "activity_created")).one()
    assert audit.actor_id == designer.id
    assert audit.target == body["id"]


def test_create_an_activity_with_each_response_scale(
    client: TestClient, study: Study, designer: UserAccount, bearer_headers
) -> None:
    url = f"/api/v1/studies/{study.id}/activities"

    numbers = client.post(
        url,
        headers=bearer_headers(designer),
        json=_payload(entry_types=["text", "scale"], options=NUMBER_SCALE),
    )
    assert numbers.status_code == 201, numbers.text
    assert numbers.json()["options"]["scale_type"] == "numbers"
    assert numbers.json()["options"]["points"] == 5
    assert numbers.json()["options"]["start_label"] == "Not at all"
    assert numbers.json()["options"]["end_label"] == "Very much"

    faces = client.post(
        url,
        headers=bearer_headers(designer),
        json=_payload(
            title="Faces",
            entry_types=["scale"],
            options={"scale_type": "faces", "points": 5, "middle_label": "Neutral"},
        ),
    )
    assert faces.status_code == 201, faces.text
    assert faces.json()["options"]["points"] == 5

    text_labels = client.post(
        url,
        headers=bearer_headers(designer),
        json=_payload(
            title="Labels",
            entry_types=["scale"],
            options={
                "scale_type": "text",
                "points": 7,
                "start_label": "Never",
                "end_label": "Always",
            },
        ),
    )
    assert text_labels.status_code == 201, text_labels.text

    slider = client.post(
        url,
        headers=bearer_headers(designer),
        json=_payload(
            title="Slider",
            entry_types=["scale"],
            options={"scale_type": "slider"},
        ),
    )
    assert slider.status_code == 201, slider.text
    assert slider.json()["options"]["points"] is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"entry_types": []},
        {"entry_types": ["text", "text"]},
        {"entry_types": ["unknown"]},
        {"entry_types": ["scale"]},
        {"options": NUMBER_SCALE},
        {"entry_types": ["scale"], "options": {"scale_type": "numbers", "points": 12}},
        {"entry_types": ["scale"], "options": {"scale_type": "numbers", "points": 1}},
        {
            "entry_types": ["scale"],
            "options": {"scale_type": "faces", "points": 4},
        },
        {
            "entry_types": ["scale"],
            "options": {
                "scale_type": "text",
                "points": 4,
                "start_label": "A",
                "end_label": "B",
            },
        },
        {
            "entry_types": ["scale"],
            "options": {"scale_type": "numbers", "points": 5, "start_label": "Low"},
        },
        {"entry_types": ["scale"], "options": {"scale_type": "slider", "points": 5}},
        {
            "entry_types": ["scale"],
            "options": {"scale_type": "slider", "middle_label": "Middle"},
        },
        {
            "entry_types": ["scale"],
            "options": {
                "scale_type": "numbers",
                "points": 4,
                "start_label": "Low",
                "end_label": "High",
                "middle_label": "Middle",
            },
        },
        {"window_start": "18:00:00", "window_end": "18:00:00"},
        {"window_start": "19:00:00", "window_end": "18:00:00"},
        {"max_free_entries_per_day": 3},
        {"prompts_per_day": 0},
        {"expected_minutes": 0},
        {"min_gap_minutes": -1},
    ],
)
def test_invalid_activities_are_refused(
    client: TestClient,
    study: Study,
    designer: UserAccount,
    bearer_headers,
    overrides: dict,
) -> None:
    response = client.post(
        f"/api/v1/studies/{study.id}/activities",
        headers=bearer_headers(designer),
        json=_payload(**overrides),
    )
    assert response.status_code == 422, response.text


def test_activities_are_listed_read_updated_and_deleted(
    client: TestClient,
    session: Session,
    study: Study,
    designer: UserAccount,
    member: UserAccount,
    bearer_headers,
) -> None:
    url = f"/api/v1/studies/{study.id}/activities"
    created = client.post(url, headers=bearer_headers(designer), json=_payload()).json()
    activity_url = f"{url}/{created['id']}"

    listing = client.get(url, headers=bearer_headers(member))
    assert listing.status_code == 200
    assert [row["id"] for row in listing.json()] == [created["id"]]

    fetched = client.get(activity_url, headers=bearer_headers(member))
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Walk"

    updated = client.patch(
        activity_url,
        headers=bearer_headers(designer),
        json={
            "title": "Evening walk",
            "prompts_per_day": 3,
            "entry_types": ["scale"],
            "options": NUMBER_SCALE,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Evening walk"
    assert updated.json()["options"]["scale_type"] == "numbers"
    assert updated.json()["options"]["points"] == 5

    invalid = client.patch(
        activity_url,
        headers=bearer_headers(designer),
        json={"options": {"scale_type": "faces", "points": 4}},
    )
    assert invalid.status_code == 422

    removed_scale = client.patch(
        activity_url,
        headers=bearer_headers(designer),
        json={"entry_types": ["text"]},
    )
    assert removed_scale.status_code == 422

    deleted = client.delete(activity_url, headers=bearer_headers(designer))
    assert deleted.status_code == 204
    assert session.get(Activity, uuid.UUID(created["id"])) is None

    missing = client.get(activity_url, headers=bearer_headers(member))
    assert missing.status_code == 404

    actions = [row.action for row in session.scalars(select(AuditLog).order_by(AuditLog.id)).all()]
    assert "activity_created" in actions
    assert "activity_updated" in actions
    assert "activity_deleted" in actions


def test_an_activity_of_another_study_is_not_found(
    client: TestClient,
    session: Session,
    study: Study,
    member: UserAccount,
    make_study,
    bearer_headers,
) -> None:
    other = make_study(title="Other")
    activity = Activity(
        study_id=other.id,
        title="Other activity",
        entry_types=["text"],
        prompts_per_day=1,
        window_start="09:00:00",
        window_end="10:00:00",
        min_gap_minutes=0,
        expected_minutes=1,
    )
    session.add(activity)
    session.commit()
    # The row belongs to another study, so the nested route must not find it.
    response = client.get(
        f"/api/v1/studies/{study.id}/activities/{activity.id}",
        headers=bearer_headers(member),
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "activity_not_found"


def test_an_outsider_cannot_read_or_change_activities(
    client: TestClient, study: Study, make_user, bearer_headers
) -> None:
    outsider = make_user(email="outsider@example.org")
    url = f"/api/v1/studies/{study.id}/activities"

    assert client.get(url, headers=bearer_headers(outsider)).status_code == 403
    assert client.post(url, headers=bearer_headers(outsider), json=_payload()).status_code == 403
    assert client.get(url).status_code == 401


def test_a_closed_study_cannot_receive_activities(
    client: TestClient,
    session: Session,
    study: Study,
    designer: UserAccount,
    bearer_headers,
) -> None:
    study.status = StudyStatus.CLOSED
    session.commit()

    response = client.post(
        f"/api/v1/studies/{study.id}/activities",
        headers=bearer_headers(designer),
        json=_payload(),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "study_closed"


def test_an_administrator_can_manage_a_study(
    client: TestClient, study: Study, make_user, bearer_headers
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)

    response = client.post(
        f"/api/v1/studies/{study.id}/activities",
        headers=bearer_headers(admin),
        json=_payload(),
    )
    assert response.status_code == 201


def test_a_member_cannot_design_activities_but_can_read_them(
    client: TestClient,
    study: Study,
    designer: UserAccount,
    member: UserAccount,
    bearer_headers,
) -> None:
    url = f"/api/v1/studies/{study.id}/activities"
    created = client.post(url, headers=bearer_headers(designer), json=_payload()).json()
    activity_url = f"{url}/{created['id']}"

    assert client.post(url, headers=bearer_headers(member), json=_payload()).status_code == 403
    assert (
        client.patch(
            activity_url, headers=bearer_headers(member), json={"title": "Changed"}
        ).status_code
        == 403
    )
    assert client.delete(activity_url, headers=bearer_headers(member)).status_code == 403

    assert client.get(url, headers=bearer_headers(member)).status_code == 200
    assert client.get(activity_url, headers=bearer_headers(member)).status_code == 200
