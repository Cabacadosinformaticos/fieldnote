from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.db import get_session
from app.main import http_exception_handler
from app.models import Participant, StudyMember, UserAccount
from app.models.enums import StudyRole, UserRole
from app.security.deps import StudyAccess, current_participant, require_admin, require_study_role


def _add_member(session: Session, study_id, user: UserAccount, role: StudyRole) -> None:
    session.add(StudyMember(study_id=study_id, user_id=user.id, role=role))
    session.commit()


@pytest.fixture
def probe(session: Session) -> FastAPI:
    application = FastAPI()
    application.add_exception_handler(HTTPException, http_exception_handler)

    def override() -> Iterator[Session]:
        yield session

    application.dependency_overrides[get_session] = override

    any_member = require_study_role(
        StudyRole.PRINCIPAL_INVESTIGATOR, StudyRole.CO_INVESTIGATOR, StudyRole.MEMBER
    )
    principal_only = require_study_role(StudyRole.PRINCIPAL_INVESTIGATOR)

    @application.get("/admin")
    def admin_route(user: Annotated[UserAccount, Depends(require_admin)]) -> dict[str, str]:
        return {"id": str(user.id)}

    @application.get("/studies/{study_id}/members")
    def members_route(
        access: Annotated[StudyAccess, Depends(any_member)],
    ) -> dict[str, str]:
        return {"id": str(access.user.id)}

    @application.get("/studies/{study_id}/principal")
    def principal_route(
        access: Annotated[StudyAccess, Depends(principal_only)],
    ) -> dict[str, str]:
        return {"id": str(access.user.id)}

    @application.get("/participants/me")
    def participant_route(
        participant: Annotated[Participant, Depends(current_participant)],
    ) -> dict[str, str]:
        return {"id": str(participant.id)}

    return application


@pytest.fixture
def probe_client(probe: FastAPI) -> Iterator[TestClient]:
    with TestClient(probe, base_url="https://testserver") as test_client:
        yield test_client


def test_admin_route_allows_only_administrators(
    probe_client: TestClient, make_user, bearer_headers
) -> None:
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)
    researcher = make_user(email="researcher@example.org")

    assert probe_client.get("/admin", headers=bearer_headers(admin)).status_code == 200
    assert probe_client.get("/admin", headers=bearer_headers(researcher)).status_code == 403
    assert probe_client.get("/admin").status_code == 401


def test_study_membership_and_each_role_are_checked(
    probe_client: TestClient, session: Session, make_user, make_study, bearer_headers
) -> None:
    study = make_study()
    principal = make_user(email="principal@example.org")
    co_investigator = make_user(email="co@example.org")
    member = make_user(email="member@example.org")
    outsider = make_user(email="outsider@example.org")
    admin = make_user(email="admin@example.org", role=UserRole.ADMIN)

    _add_member(session, study.id, principal, StudyRole.PRINCIPAL_INVESTIGATOR)
    _add_member(session, study.id, co_investigator, StudyRole.CO_INVESTIGATOR)
    _add_member(session, study.id, member, StudyRole.MEMBER)

    members_url = f"/studies/{study.id}/members"
    principal_url = f"/studies/{study.id}/principal"

    for user in (principal, co_investigator, member, admin):
        assert probe_client.get(members_url, headers=bearer_headers(user)).status_code == 200
    assert probe_client.get(members_url, headers=bearer_headers(outsider)).status_code == 403

    assert probe_client.get(principal_url, headers=bearer_headers(principal)).status_code == 200
    assert probe_client.get(principal_url, headers=bearer_headers(admin)).status_code == 200
    assert (
        probe_client.get(principal_url, headers=bearer_headers(co_investigator)).status_code == 403
    )
    assert probe_client.get(principal_url, headers=bearer_headers(member)).status_code == 403


def test_device_token_authenticates_the_matching_participant(
    probe_client: TestClient, make_study, make_participant
) -> None:
    study = make_study()
    device_token = "a" * 43
    participant = make_participant(study, device_token=device_token)

    accepted = probe_client.get(
        "/participants/me", headers={"Authorization": f"Device {device_token}"}
    )
    assert accepted.status_code == 200
    assert accepted.json() == {"id": str(participant.id)}

    unknown = probe_client.get(
        "/participants/me", headers={"Authorization": "Device unknown-token"}
    )
    assert unknown.status_code == 401
    assert unknown.json()["error"]["code"] == "invalid_device_token"


def test_researcher_and_device_authentication_do_not_mix(
    probe_client: TestClient, make_user, make_study, make_participant, bearer_headers
) -> None:
    researcher = make_user()
    study = make_study()
    device_token = "b" * 43
    make_participant(study, device_token=device_token)

    assert (
        probe_client.get("/participants/me", headers=bearer_headers(researcher)).status_code == 401
    )
    assert (
        probe_client.get("/admin", headers={"Authorization": f"Device {device_token}"}).status_code
        == 401
    )
