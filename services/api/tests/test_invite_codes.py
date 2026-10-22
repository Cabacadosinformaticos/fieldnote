from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Availability,
    Consent,
    InviteCode,
    Participant,
    StudyAnswer,
    StudyMember,
)
from app.models.enums import (
    InviteCodeKind,
    ParticipantStatus,
    QuestionKind,
    StudyRole,
    UserRole,
)
from app.security import codes, tokens

API = "/api/v1"
LISBON = ZoneInfo("Europe/Lisbon")


def _url(study, suffix: str = "") -> str:
    return f"{API}/studies/{study.id}/invite-codes{suffix}"


def _approvals_url(study, suffix: str = "") -> str:
    return f"{API}/studies/{study.id}/approvals{suffix}"


def _add_member(session: Session, study, user, role: StudyRole = StudyRole.MEMBER) -> None:
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()


def _code_row(session: Session, study, **overrides) -> InviteCode:
    values = {
        "study_id": study.id,
        "kind": InviteCodeKind.STUDY,
        "code_value": codes.generate_study_code(),
        "name": "Cartaz",
        "max_uses": None,
        "max_per_hour": None,
        "uses": 0,
        "expires_at": datetime.now(UTC) + timedelta(days=7),
        "requires_approval": True,
        "requires_account": False,
    }
    values.update(overrides)
    code = InviteCode(**values)
    session.add(code)
    session.commit()
    return code


def _pending(session: Session, study, code, *, entered_at: datetime | None = None) -> Participant:
    participant = Participant(
        study_id=study.id,
        alias=None,
        admitted_by_code_id=code.id,
        status=ParticipantStatus.PENDING_APPROVAL,
        entered_at=entered_at or datetime.now(UTC),
        push_token="push-token",
        device_token_hash=tokens.hash_token(codes.generate_device_token()),
    )
    session.add(participant)
    session.flush()
    session.add(Consent(participant_id=participant.id, version="v1"))
    session.add(
        StudyAnswer(
            participant_id=participant.id,
            question_text="Why?",
            kind=QuestionKind.SHORT_TEXT,
            answer="Because",
        )
    )
    session.add(
        Availability(
            participant_id=participant.id,
            start_time=time(9, 0),
            end_time=time(12, 0),
            weekdays=[1, 2],
        )
    )
    session.commit()
    return participant


def _local_today() -> date:
    return datetime.now(UTC).astimezone(LISBON).date()


def _end_of_day(on: date) -> datetime:
    start = datetime.combine(on + timedelta(days=1), time.min, tzinfo=LISBON)
    return (start - timedelta(microseconds=1)).astimezone(UTC)


def test_create_study_code_defaults_and_ends_at_the_end_of_the_local_day(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    end_date = _local_today() + timedelta(days=5)

    response = client.post(
        _url(study),
        headers=bearer_headers(user),
        json={"name": "Cartaz no quiosque", "end_date": end_date.isoformat()},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Cartaz no quiosque"
    assert codes.normalize_code(body["code"]) == body["code"]
    assert not codes.is_personal_code(body["code"])
    assert body["max_uses"] is None
    assert body["max_per_hour"] is None
    assert body["uses"] == 0
    assert body["active"] is True
    assert body["requires_approval"] is True
    assert body["requires_account"] is False
    assert body["state"] == "active"
    assert datetime.fromisoformat(body["expires_at"]) == _end_of_day(end_date)

    stored = session.get(InviteCode, body["id"])
    assert stored is not None
    assert stored.code_value == body["code"]
    assert stored.code_hash is None
    assert stored.kind == InviteCodeKind.STUDY
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "study_code_created", AuditLog.target == body["id"]
            )
        )
        is not None
    )


def test_create_study_code_with_every_option(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)

    response = client.post(
        _url(study),
        headers=bearer_headers(user),
        json={
            "name": "Folheto",
            "end_date": (_local_today() + timedelta(days=2)).isoformat(),
            "max_uses": 10,
            "max_per_hour": 3,
            "requires_approval": False,
            "requires_account": True,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert (body["max_uses"], body["max_per_hour"]) == (10, 3)
    assert body["requires_approval"] is False
    assert body["requires_account"] is True


def test_create_study_code_rejects_an_end_date_in_the_past(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)

    response = client.post(
        _url(study),
        headers=bearer_headers(user),
        json={"name": "Old", "end_date": (_local_today() - timedelta(days=1)).isoformat()},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_end_date"


def test_list_shows_the_readable_code_its_settings_and_its_uses(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    created = client.post(
        _url(study),
        headers=headers,
        json={"name": "Cartaz", "end_date": (_local_today() + timedelta(days=3)).isoformat()},
    ).json()
    code = session.get(InviteCode, created["id"])
    assert code is not None
    code.uses = 2
    session.commit()

    _pending(session, study, code)
    session.add(
        Participant(
            study_id=study.id,
            alias="P-02",
            status=ParticipantStatus.ACTIVE,
            admitted_by_code_id=code.id,
            entered_at=datetime.now(UTC),
        )
    )
    session.add(
        Participant(
            study_id=study.id,
            status=ParticipantStatus.DECLINED,
            admitted_by_code_id=code.id,
            entered_at=datetime.now(UTC),
        )
    )
    session.commit()
    client.post(
        _url(study),
        headers=headers,
        json={"name": "Folheto", "end_date": (_local_today() + timedelta(days=4)).isoformat()},
    )

    response = client.get(_url(study), headers=headers)

    assert response.status_code == 200
    rows = {row["id"]: row for row in response.json()}
    assert len(rows) == 2
    row = rows[created["id"]]
    assert row["code"] == created["code"]
    assert row["uses"] == 2
    assert row["waiting_count"] == 1
    assert row["approved_count"] == 1
    assert row["declined_count"] == 1
    assert row["state"] == "active"


def test_update_changes_settings_clears_a_limit_and_switches_the_code(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    created = client.post(
        _url(study),
        headers=headers,
        json={
            "name": "Cartaz",
            "end_date": (_local_today() + timedelta(days=3)).isoformat(),
            "max_uses": 5,
            "max_per_hour": 2,
        },
    ).json()
    url = _url(study, f"/{created['id']}")
    new_end = _local_today() + timedelta(days=9)

    response = client.patch(
        url,
        headers=headers,
        json={
            "name": "Cartaz novo",
            "end_date": new_end.isoformat(),
            "max_uses": None,
            "max_per_hour": 4,
            "requires_approval": False,
            "requires_account": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Cartaz novo"
    assert body["max_uses"] is None
    assert body["max_per_hour"] == 4
    assert body["requires_approval"] is False
    assert body["requires_account"] is True
    assert datetime.fromisoformat(body["expires_at"]) == _end_of_day(new_end)
    assert (
        session.scalar(select(AuditLog).where(AuditLog.action == "study_code_updated")) is not None
    )

    switched_off = client.patch(url, headers=headers, json={"active": False}).json()
    assert switched_off["active"] is False
    assert switched_off["state"] == "off"
    switched_on = client.patch(url, headers=headers, json={"active": True}).json()
    assert switched_on["active"] is True
    assert switched_on["state"] == "active"
    actions = set(session.scalars(select(AuditLog.action)).all())
    assert {"study_code_switched_off", "study_code_switched_on"} <= actions


def test_update_refuses_to_clear_a_required_field(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    created = client.post(
        _url(study),
        headers=headers,
        json={"name": "Cartaz", "end_date": (_local_today() + timedelta(days=3)).isoformat()},
    ).json()

    response = client.patch(_url(study, f"/{created['id']}"), headers=headers, json={"name": None})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_regenerate_replaces_the_code_and_keeps_uses_and_settings(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    created = client.post(
        _url(study),
        headers=headers,
        json={
            "name": "Cartaz",
            "end_date": (_local_today() + timedelta(days=3)).isoformat(),
            "max_uses": 4,
            "requires_account": True,
        },
    ).json()
    code = session.get(InviteCode, created["id"])
    assert code is not None
    code.uses = 3
    session.commit()
    old_value = created["code"]

    response = client.post(_url(study, f"/{created['id']}/regenerate"), headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["code"] != old_value
    assert codes.normalize_code(body["code"]) == body["code"]
    assert body["uses"] == 3
    assert body["max_uses"] == 4
    assert body["requires_account"] is True
    session.expire_all()
    assert session.scalar(select(InviteCode).where(InviteCode.code_value == old_value)) is None
    assert (
        session.scalar(select(AuditLog).where(AuditLog.action == "study_code_regenerated"))
        is not None
    )


def test_study_code_endpoints_need_a_member_and_are_scoped_to_the_study(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    other_study = make_study(title="Other")
    user = make_user()
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    _add_member(session, study, user)
    foreign_code = _code_row(session, other_study)

    assert client.get(_url(study)).status_code == 401
    assert client.get(_url(study), headers=bearer_headers(outsider)).status_code == 403
    assert (
        client.patch(
            _url(study, f"/{foreign_code.id}"),
            headers=bearer_headers(user),
            json={"name": "Changed"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            _url(study),
            headers=bearer_headers(admin),
            json={
                "name": "Admin code",
                "end_date": (_local_today() + timedelta(days=1)).isoformat(),
            },
        ).status_code
        == 201
    )


def test_waiting_list_shows_only_order_time_and_code(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    code = _code_row(session, study)
    first = _pending(session, study, code, entered_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC))
    second = _pending(session, study, code, entered_at=datetime(2026, 10, 1, 11, 0, tzinfo=UTC))
    other_study = make_study(title="Other")
    other_code = _code_row(session, other_study)
    _pending(session, other_study, other_code)

    response = client.get(_approvals_url(study), headers=bearer_headers(user))

    assert response.status_code == 200
    rows = response.json()
    assert [row["order"] for row in rows] == [1, 2]
    assert [row["participant_id"] for row in rows] == [str(first.id), str(second.id)]
    assert all(row["code"] == code.code_value for row in rows)
    expected_keys = {
        "order",
        "participant_id",
        "entered_at",
        "invite_code_id",
        "code",
    }
    assert all(set(row) == expected_keys for row in rows)


def test_approve_assigns_a_new_alias_and_audits(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    code = _code_row(session, study)
    first = _pending(session, study, code, entered_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC))
    second = _pending(session, study, code, entered_at=datetime(2026, 10, 1, 11, 0, tzinfo=UTC))

    first_response = client.post(_approvals_url(study, f"/{first.id}/approve"), headers=headers)
    second_response = client.post(_approvals_url(study, f"/{second.id}/approve"), headers=headers)

    assert first_response.status_code == 200
    assert first_response.json()["status"] == "active"
    assert first_response.json()["alias"] == "P-01"
    assert second_response.json()["alias"] == "P-02"
    session.expire_all()
    stored = session.get(Participant, first.id)
    assert stored is not None
    assert stored.status == ParticipantStatus.ACTIVE
    assert stored.decided_by == user.id
    assert stored.decided_at is not None
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "participant_approved", AuditLog.target == str(first.id)
            )
        )
        is not None
    )

    again = client.post(_approvals_url(study, f"/{first.id}/approve"), headers=headers)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "participant_not_pending"


def test_decline_deletes_the_personal_data_and_frees_a_place(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    _add_member(session, study, user)
    headers = bearer_headers(user)
    code = _code_row(session, study, uses=1)
    participant = _pending(session, study, code)

    response = client.post(_approvals_url(study, f"/{participant.id}/decline"), headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "declined"
    assert response.json()["alias"] is None
    session.expire_all()
    stored = session.get(Participant, participant.id)
    assert stored is not None
    assert stored.push_token is None
    assert stored.decided_by == user.id
    assert (
        session.scalars(select(Consent).where(Consent.participant_id == participant.id)).all() == []
    )
    assert (
        session.scalars(
            select(StudyAnswer).where(StudyAnswer.participant_id == participant.id)
        ).all()
        == []
    )
    assert (
        session.scalars(
            select(Availability).where(Availability.participant_id == participant.id)
        ).all()
        == []
    )
    assert session.get(InviteCode, code.id).uses == 0
    assert (
        session.scalar(
            select(AuditLog).where(
                AuditLog.action == "participant_declined", AuditLog.target == str(participant.id)
            )
        )
        is not None
    )


def test_decline_never_makes_the_uses_counter_negative_and_refuses_outsiders(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    user = make_user()
    outsider = make_user(email="outsider@example.org")
    _add_member(session, study, user)
    code = _code_row(session, study, uses=0)
    participant = _pending(session, study, code)

    refused = client.post(
        _approvals_url(study, f"/{participant.id}/decline"), headers=bearer_headers(outsider)
    )
    assert refused.status_code == 403
    assert client.get(_approvals_url(study)).status_code == 401

    response = client.post(
        _approvals_url(study, f"/{participant.id}/decline"), headers=bearer_headers(user)
    )

    assert response.status_code == 200
    session.expire_all()
    assert session.get(InviteCode, code.id).uses == 0
