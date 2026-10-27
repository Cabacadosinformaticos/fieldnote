import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "_database_ok", lambda: True)
    monkeypatch.setattr(main, "_broker_ok", lambda: True)
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": True, "broker": True}}


def test_health_ready_fails_without_the_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "_database_ok", lambda: False)
    monkeypatch.setattr(main, "_broker_ok", lambda: True)
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json()["checks"] == {"database": False, "broker": True}


def test_unknown_route_returns_error_body() -> None:
    response = client.get("/api/v1/unknown")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not Found"}}
