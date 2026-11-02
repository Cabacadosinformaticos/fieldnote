"""The volunteer pool: joining, the profile, recruitment and invitations."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AccountParticipation,
    AuditLog,
    Consent,
    OutboxEvent,
    Participant,
    ParticipantIdentity,
    PoolInvitation,
    PoolMember,
    StudyMember,
    UserAccount,
)
from app.models.enums import (
    AuditActorType,
    ParticipantStatus,
    PoolInvitationStatus,
    StudyRole,
    StudyStatus,
    UserRole,
)
from app.security import codes
from app.services import participation as participation_service
from app.services import pool as pool_service

BASE = "/api/v1/pool"
PARTICIPATION_ME = "/api/v1/participation/me"


def _pool(credential: str) -> dict[str, str]:
    return {"Authorization": f"Pool {credential}"}


def _device(token: str) -> dict[str, str]:
    return {"Authorization": f"Device {token}"}


def _add_member(
    session: Session,
    *,
    concelho: str = "Lisboa",
    invitations_paused: bool = False,
    **fields: object,
) -> tuple[PoolMember, str]:
    raw = codes.generate_device_token()
    member = PoolMember(
        credential_hash=codes.hash_device_token(raw),
        concelho=concelho,
        invitations_paused=invitations_paused,
        joined_at=datetime.now(UTC),
        **fields,
    )
    session.add(member)
    session.commit()
    return member, raw


def _add_researcher(
    session: Session,
    study,
    make_user,
    email: str = "researcher@example.org",
    role: StudyRole = StudyRole.PRINCIPAL_INVESTIGATOR,
):
    user = make_user(email=email)
    session.add(StudyMember(study_id=study.id, user_id=user.id, role=role))
    session.commit()
    return user


def _send(client: TestClient, study, criteria: dict[str, object], headers):
    return client.post(
        f"/api/v1/studies/{study.id}/pool/invitations", json=criteria, headers=headers
    )


def test_joining_requires_a_concelho_and_stores_only_a_credential_hash(
    client: TestClient, session: Session
) -> None:
    assert client.post(f"{BASE}/members", json={}).status_code == 422
    assert client.post(f"{BASE}/members", json={"concelho": "   "}).status_code == 422

    response = client.post(
        f"{BASE}/members",
        json={
            "concelho": "  Lisboa ",
            "freguesia": "Alvalade",
            "age_band": "25-34",
            "gender": "female",
            "occupation": "employee",
            "usual_transport": "public_transport",
            "languages": ["pt", "en", "pt"],
            "push_token": "ExponentPushToken[abc]",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["concelho"] == "Lisboa"
    assert body["languages"] == ["pt", "en"]
    assert body["token_type"] == "Pool"
    assert body["account_linked"] is False
    credential = body["credential"]

    member = session.scalar(select(PoolMember))
    assert member is not None
    assert member.credential_hash == codes.hash_device_token(credential)
    assert credential not in member.credential_hash
    assert not {"name", "email", "phone"} & set(PoolMember.__table__.columns.keys())

    me = client.get(f"{BASE}/me", headers=_pool(credential))
    assert me.status_code == 200
    assert me.json()["concelho"] == "Lisboa"
    assert client.get(f"{BASE}/me", headers=_pool("wrong")).status_code == 401
    assert client.get(f"{BASE}/me").status_code == 401


def test_the_profile_can_be_changed_and_paused(client: TestClient) -> None:
    joined = client.post(f"{BASE}/members", json={"concelho": "Lisboa"})
    headers = _pool(joined.json()["credential"])

    changed = client.patch(
        f"{BASE}/me",
        json={
            "freguesia": "Alvalade",
            "age_band": "25-34",
            "gender": "female",
            "occupation": "employee",
            "usual_transport": "walking",
            "languages": ["pt", "en"],
            "invitations_paused": True,
        },
        headers=headers,
    )
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["freguesia"] == "Alvalade"
    assert body["languages"] == ["pt", "en"]
    assert body["invitations_paused"] is True

    cleared = client.patch(
        f"{BASE}/me", json={"freguesia": None, "languages": None}, headers=headers
    )
    assert cleared.status_code == 200
    assert cleared.json()["freguesia"] is None
    assert cleared.json()["languages"] is None
    assert cleared.json()["age_band"] == "25-34"

    refused = client.patch(f"{BASE}/me", json={"concelho": None}, headers=headers)
    assert refused.status_code == 422


def test_leaving_deletes_the_member_and_keeps_the_invitation_without_a_member(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    member, credential = _add_member(session)
    invitation = PoolInvitation(
        study_id=study.id,
        pool_member_id=member.id,
        status=PoolInvitationStatus.SENT,
        sent_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(invitation)
    session.commit()
    invitation_id = invitation.id
    member_id = member.id

    response = client.delete(f"{BASE}/me", headers=_pool(credential))

    assert response.status_code == 204
    assert session.get(PoolMember, member_id) is None
    session.expire_all()
    kept = session.get(PoolInvitation, invitation_id)
    assert kept is not None and kept.pool_member_id is None
    assert client.get(f"{BASE}/me", headers=_pool(credential)).status_code == 401


def test_a_group_below_five_is_hidden_and_criteria_narrow_the_count(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    headers = bearer_headers(researcher)
    count_url = f"/api/v1/studies/{study.id}/pool/count"

    for _ in range(4):
        _add_member(session, concelho="Lisboa")
    hidden = client.post(count_url, json={"concelho": "Lisboa"}, headers=headers)
    assert hidden.status_code == 200
    assert hidden.json() == {"count": None, "minimum": 5}

    for _ in range(5):
        _add_member(
            session,
            concelho="Lisboa",
            freguesia="Alvalade",
            age_band="25-34",
            gender="female",
            occupation="employee",
            usual_transport="public_transport",
            languages=["pt", "en"],
        )
    _add_member(
        session,
        concelho="Lisboa",
        invitations_paused=True,
        age_band="25-34",
        languages=["en"],
    )
    for _ in range(2):
        _add_member(session, concelho="Porto")

    def counted(criteria: dict[str, object]) -> int | None:
        response = client.post(count_url, json=criteria, headers=headers)
        assert response.status_code == 200, response.text
        return response.json()["count"]

    assert counted({"concelho": "Lisboa"}) == 9
    assert counted({}) == 11
    assert counted({"concelho": "Lisboa", "freguesia": "Alvalade"}) == 5
    assert counted({"concelho": "Lisboa", "age_band": "25-34"}) == 5
    assert counted({"gender": "female"}) == 5
    assert counted({"occupation": "employee"}) == 5
    assert counted({"usual_transport": "public_transport"}) == 5
    assert counted({"language": "en"}) == 5
    assert counted({"concelho": "Lisboa", "age_band": "65+"}) is None
    assert counted({"concelho": "Porto"}) is None

    assert client.post(count_url, json={}).status_code == 401
    outsider = make_user(email="outsider@example.org")
    assert client.post(count_url, json={}, headers=bearer_headers(outsider)).status_code == 403

    study.status = StudyStatus.CLOSED
    session.commit()
    closed = client.post(count_url, json={}, headers=headers)
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "study_closed"


def test_sending_needs_five_members_is_audited_and_pushes_a_generic_text(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    headers = bearer_headers(researcher)

    for _ in range(4):
        _add_member(session, concelho="Lisboa")
    refused = _send(client, study, {"concelho": "Lisboa"}, headers)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "pool_group_too_small"
    assert session.scalar(select(PoolInvitation)) is None

    _add_member(session, concelho="Lisboa", push_token="ExponentPushToken[abc]")
    sent = _send(client, study, {"concelho": "Lisboa"}, headers)

    assert sent.status_code == 201, sent.text
    assert sent.json()["sent"] == 5
    expires_at = datetime.fromisoformat(sent.json()["expires_at"])
    invitations = list(session.scalars(select(PoolInvitation)))
    assert len(invitations) == 5
    for invitation in invitations:
        assert invitation.status == PoolInvitationStatus.SENT
        assert invitation.pool_member_id is not None
        assert abs(invitation.expires_at - expires_at) < timedelta(seconds=1)
        assert invitation.expires_at - invitation.sent_at == timedelta(days=7)

    audit = session.scalar(select(AuditLog).where(AuditLog.action == "pool_invitations_sent"))
    assert audit is not None
    assert audit.actor_type == AuditActorType.USER
    assert audit.actor_id == researcher.id
    assert audit.target == str(study.id)
    assert audit.details is not None
    assert audit.details["sent"] == 5
    assert audit.details["criteria"] == {"concelho": "Lisboa"}

    events = list(session.scalars(select(OutboxEvent)))
    assert len(events) == 1
    assert events[0].event_type == pool_service.POOL_INVITATION_EVENT
    assert events[0].payload["text"] == pool_service.POOL_INVITATION_TEXT
    assert "estudo" in events[0].payload["text"]
    assert "study" not in events[0].payload
    assert "concelho" not in events[0].payload
    assert "title" not in events[0].payload

    # There is no route that gives a researcher the pool profiles or the invitations.
    assert (
        client.get(f"/api/v1/studies/{study.id}/pool/invitations", headers=headers).status_code
        == 405
    )


def test_a_member_sees_the_invitation_and_accepts_it_as_a_new_participant(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study(title="Diário de Lisboa")
    researcher = _add_researcher(session, study, make_user)
    members = [_add_member(session, concelho="Lisboa") for _ in range(5)]
    member, credential = members[0]
    _, other_credential = members[1]

    sent = _send(client, study, {"concelho": "Lisboa"}, bearer_headers(researcher))
    assert sent.status_code == 201

    listing = client.get(f"{BASE}/invitations", headers=_pool(credential))
    assert listing.status_code == 200
    rows = listing.json()
    assert len(rows) == 1
    invitation = rows[0]
    assert invitation["status"] == "sent"
    assert invitation["reason"] == "pool_member"
    assert invitation["concelho"] == "Lisboa"
    assert invitation["study"]["title"] == "Diário de Lisboa"
    assert "participant_id" not in invitation
    invitation_id = invitation["id"]

    foreign = client.get(f"{BASE}/invitations/{invitation_id}", headers=_pool(other_credential))
    assert foreign.status_code == 404
    assert (
        client.get(f"{BASE}/invitations/{invitation_id}", headers=_pool(credential)).status_code
        == 200
    )

    accepted = client.post(
        f"{BASE}/invitations/{invitation_id}/accept",
        json={"consent_version": "1.0", "locale": "pt"},
        headers=_pool(credential),
    )

    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["outcome"] == "joined"
    assert body["token_type"] == "Device"
    assert body["participant"]["alias"] == "P-01"
    assert body["participant"]["status"] == "active"
    assert body["participant"]["has_consent"] is True
    participant = session.get(Participant, uuid.UUID(body["participant"]["id"]))
    assert participant is not None
    assert participant.study_id == study.id
    assert participant.entered_at is not None
    assert participant.device_hash is None
    assert session.get(AccountParticipation, participant.id) is None
    assert session.scalar(select(ParticipantIdentity)) is None
    consent = session.scalar(select(Consent).where(Consent.participant_id == participant.id))
    assert consent is not None

    stored = session.get(PoolInvitation, uuid.UUID(invitation_id))
    assert stored is not None
    assert stored.status == PoolInvitationStatus.ACCEPTED
    assert stored.responded_at is not None

    me = client.get(PARTICIPATION_ME, headers=_device(body["device_token"]))
    assert me.status_code == 200
    assert me.json()["alias"] == "P-01"
    assert client.get(PARTICIPATION_ME, headers=_device("bogus")).status_code == 401

    # The profile stays in the pool and is unchanged.
    profile = client.get(f"{BASE}/me", headers=_pool(credential))
    assert profile.status_code == 200
    assert profile.json()["concelho"] == "Lisboa"
    assert member.id is not None


def test_accepting_twice_by_device_or_account_is_refused(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    headers = bearer_headers(researcher)
    existing = Participant(
        study_id=study.id,
        alias="P-01",
        device_hash=participation_service.compute_device_hash(study, "android-1"),
        status=ParticipantStatus.ACTIVE,
        entered_at=datetime.now(UTC),
    )
    session.add(existing)
    session.commit()
    members = [_add_member(session) for _ in range(5)]
    _, first_credential = members[0]
    _, second_credential = members[1]
    assert _send(client, study, {}, headers).status_code == 201

    first_invitation = client.get(f"{BASE}/invitations", headers=_pool(first_credential)).json()[0]
    duplicate = client.post(
        f"{BASE}/invitations/{first_invitation['id']}/accept",
        json={"consent_version": "1.0", "android_id": "android-1"},
        headers=_pool(first_credential),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "already_participating"
    assert (
        session.get(PoolInvitation, uuid.UUID(first_invitation["id"])).status
        == PoolInvitationStatus.SENT
    )

    second_rows = client.get(f"{BASE}/invitations", headers=_pool(second_credential)).json()
    second_invitation = second_rows[0]
    joined = client.post(
        f"{BASE}/invitations/{second_invitation['id']}/accept",
        json={"consent_version": "1.0", "android_id": "android-2"},
        headers=_pool(second_credential),
    )
    assert joined.status_code == 200, joined.text
    participant = session.get(Participant, uuid.UUID(joined.json()["participant"]["id"]))
    assert participant.device_hash == participation_service.compute_device_hash(study, "android-2")
    assert participant.alias == "P-02"

    assert _send(client, study, {}, headers).status_code == 201
    again = client.get(f"{BASE}/invitations", headers=_pool(second_credential)).json()[0]
    refused = client.post(
        f"{BASE}/invitations/{again['id']}/accept",
        json={"consent_version": "1.0", "android_id": "android-2"},
        headers=_pool(second_credential),
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "already_participating"


def test_accepting_links_the_new_participation_to_the_account(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    joined = client.post(f"{BASE}/members", json={"concelho": "Lisboa"})
    credential = joined.json()["credential"]
    for _ in range(4):
        _add_member(session)

    created = client.post("/api/v1/account/recovery").json()
    confirmed = client.post(
        "/api/v1/account/confirm",
        json={"device_tokens": [], "pool_credential": credential},
        headers={"Authorization": f"Account {created['account_token']}"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["pool_linked"] is True

    assert _send(client, study, {}, bearer_headers(researcher)).status_code == 201
    invitation = client.get(f"{BASE}/invitations", headers=_pool(credential)).json()[0]
    accepted = client.post(
        f"{BASE}/invitations/{invitation['id']}/accept",
        json={"consent_version": "1.0"},
        headers=_pool(credential),
    )

    assert accepted.status_code == 200, accepted.text
    participant_id = uuid.UUID(accepted.json()["participant"]["id"])
    link = session.get(AccountParticipation, participant_id)
    assert link is not None and link.study_id == study.id
    account = client.get(
        "/api/v1/account/me",
        headers={"Authorization": f"Account {created['account_token']}"},
    )
    assert account.status_code == 200
    assert [row["participant_id"] for row in account.json()["participations"]] == [
        str(participant_id)
    ]

    # A second invitation for the same study is refused without being used up.
    assert _send(client, study, {}, bearer_headers(researcher)).status_code == 201
    another = [
        row
        for row in client.get(f"{BASE}/invitations", headers=_pool(credential)).json()
        if row["status"] == "sent"
    ][0]
    refused = client.post(
        f"{BASE}/invitations/{another['id']}/accept",
        json={"consent_version": "1.0"},
        headers=_pool(credential),
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "already_participating"


def test_declining_does_not_create_a_participant(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    members = [_add_member(session) for _ in range(5)]
    _, credential = members[0]
    assert _send(client, study, {}, bearer_headers(researcher)).status_code == 201
    invitation_id = client.get(f"{BASE}/invitations", headers=_pool(credential)).json()[0]["id"]

    declined = client.post(f"{BASE}/invitations/{invitation_id}/decline", headers=_pool(credential))

    assert declined.status_code == 200
    assert declined.json()["status"] == "declined"
    assert declined.json()["responded_at"] is not None
    assert session.scalar(select(Participant)) is None

    again = client.post(f"{BASE}/invitations/{invitation_id}/decline", headers=_pool(credential))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invitation_already_answered"
    accepted = client.post(
        f"{BASE}/invitations/{invitation_id}/accept",
        json={"consent_version": "1.0"},
        headers=_pool(credential),
    )
    assert accepted.status_code == 409
    assert accepted.json()["error"]["code"] == "invitation_already_answered"


def test_an_expired_invitation_is_shown_as_expired_and_cannot_be_answered(
    client: TestClient, session: Session, make_study
) -> None:
    study = make_study()
    member, credential = _add_member(session)
    other, other_credential = _add_member(session)
    invitation = PoolInvitation(
        study_id=study.id,
        pool_member_id=member.id,
        status=PoolInvitationStatus.SENT,
        sent_at=datetime.now(UTC) - timedelta(days=8),
        expires_at=datetime.now(UTC) - timedelta(days=1),
    )
    session.add(invitation)
    session.commit()
    invitation_id = invitation.id

    listed = client.get(f"{BASE}/invitations", headers=_pool(credential))
    assert listed.status_code == 200
    assert listed.json()[0]["status"] == "expired"
    assert client.get(f"{BASE}/invitations", headers=_pool(other_credential)).json() == []
    foreign = client.get(f"{BASE}/invitations/{invitation_id}", headers=_pool(other_credential))
    assert foreign.status_code == 404

    for action in ("accept", "decline"):
        response = client.post(
            f"{BASE}/invitations/{invitation_id}/{action}",
            json={"consent_version": "1.0"} if action == "accept" else None,
            headers=_pool(credential),
        )
        assert response.status_code == 409, response.text
        assert response.json()["error"]["code"] == "invitation_expired"
    assert other.id is not None


def test_a_closed_study_cannot_accept_an_invitation(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    members = [_add_member(session) for _ in range(5)]
    _, credential = members[0]
    assert _send(client, study, {}, bearer_headers(researcher)).status_code == 201
    invitation_id = client.get(f"{BASE}/invitations", headers=_pool(credential)).json()[0]["id"]
    study.status = StudyStatus.CLOSED
    session.commit()

    response = client.post(
        f"{BASE}/invitations/{invitation_id}/accept",
        json={"consent_version": "1.0", "android_id": "android-1"},
        headers=_pool(credential),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "study_closed"
    assert session.get(PoolInvitation, uuid.UUID(invitation_id)).status == PoolInvitationStatus.SENT
    assert session.scalar(select(Participant).where(Participant.study_id == study.id)) is None


def test_a_duplicate_device_hash_is_answered_with_already_participating(
    client: TestClient,
    session: Session,
    make_study,
    make_user,
    bearer_headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    existing = Participant(
        study_id=study.id,
        alias="P-01",
        device_hash=participation_service.compute_device_hash(study, "android-1"),
        status=ParticipantStatus.ACTIVE,
        entered_at=datetime.now(UTC),
    )
    session.add(existing)
    session.commit()
    members = [_add_member(session) for _ in range(5)]
    _, credential = members[0]
    assert _send(client, study, {}, bearer_headers(researcher)).status_code == 201
    invitation_id = client.get(f"{BASE}/invitations", headers=_pool(credential)).json()[0]["id"]
    # Simulate the check losing the race: the row appears only at the unique constraint.
    monkeypatch.setattr(pool_service, "_existing_participation", lambda *args: None)

    response = client.post(
        f"{BASE}/invitations/{invitation_id}/accept",
        json={"consent_version": "1.0", "android_id": "android-1"},
        headers=_pool(credential),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "already_participating"
    assert (
        session.scalar(
            select(func.count()).select_from(Participant).where(Participant.study_id == study.id)
        )
        == 1
    )


def test_admin_pool_overview_aggregates_and_hides_small_groups(
    client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    for _ in range(6):
        _add_member(session, concelho="Lisboa", freguesia="Centro", age_band="25-34")
    for _ in range(5):
        _add_member(session, concelho="Porto", freguesia="Centro")
    for _ in range(4):
        _add_member(session, concelho="Faro")
    for _ in range(3):
        _add_member(session, concelho="Braga")
    study = make_study(title="Diary")
    now = datetime.now(UTC)
    statuses = (
        [PoolInvitationStatus.SENT] * 6
        + [PoolInvitationStatus.ACCEPTED] * 2
        + [PoolInvitationStatus.DECLINED]
        + [PoolInvitationStatus.EXPIRED]
    )
    for status in statuses:
        session.add(
            PoolInvitation(
                study_id=study.id,
                status=status,
                sent_at=now,
                expires_at=now + timedelta(days=7),
                responded_at=now if status != PoolInvitationStatus.SENT else None,
            )
        )
    session.commit()
    admin = make_user(email="pool-admin@example.org", role=UserRole.ADMIN)
    researcher = make_user(email="pool-researcher@example.org")

    response = client.get("/api/v1/admin/pool/overview", headers=bearer_headers(admin))
    refused = client.get("/api/v1/admin/pool/overview", headers=bearer_headers(researcher))

    assert refused.status_code == 403
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["members_total"] == 18
    assert body["top_concelhos"] == 15
    assert body["concelhos"] == [
        {"concelho": "Lisboa", "members": 6},
        {"concelho": "Porto", "members": 5},
        {"concelho": "Outros", "members": 7},
    ]
    assert body["fields"] == {
        "concelho": 18,
        "freguesia": 11,
        "age_band": 6,
        "gender": 0,
        "occupation": 0,
        "usual_transport": 0,
        "languages": 0,
    }
    assert body["invitations_sent"] == 10
    assert body["invitations_accepted"] == 2
    assert body["invitation_results"] == [
        {
            "study_id": str(study.id),
            "study_title": "Diary",
            "sent": 6,
            "accepted": 2,
            "declined": 1,
            "expired": 1,
        }
    ]


def test_a_closed_study_cannot_send_invitations(
    client: TestClient, session: Session, make_study, make_user, bearer_headers
) -> None:
    study = make_study()
    researcher = _add_researcher(session, study, make_user)
    for _ in range(5):
        _add_member(session)
    study.status = StudyStatus.CLOSED
    session.commit()

    response = _send(client, study, {}, bearer_headers(researcher))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "study_closed"
    assert session.scalar(select(func.count()).select_from(PoolInvitation)) == 0
    assert isinstance(researcher, UserAccount)
