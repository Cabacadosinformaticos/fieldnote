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


class _BrokerParameters:
    def __init__(self, url: str) -> None:
        self.url = url
        self.socket_timeout = None
        self.blocked_connection_timeout = None
        self.connection_attempts = None


def test_broker_ok_accepts_any_address_of_a_comma_separated_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main.settings, "rabbitmq_url", "amqp://first, amqp://second")
    attempted: list[_BrokerParameters] = []

    def parameters(url: str) -> _BrokerParameters:
        row = _BrokerParameters(url)
        attempted.append(row)
        return row

    class Connection:
        def __init__(self, row: _BrokerParameters) -> None:
            if row.url == "amqp://first":
                raise OSError("that node is down")

        def close(self) -> None:
            pass

    monkeypatch.setattr(main.pika, "URLParameters", parameters)
    monkeypatch.setattr(main.pika, "BlockingConnection", Connection)

    assert main._broker_ok() is True
    assert [row.url for row in attempted] == ["amqp://first", "amqp://second"]
    assert all(row.socket_timeout == 2 for row in attempted)
    assert all(row.connection_attempts == 1 for row in attempted)


def test_broker_ok_is_false_when_no_address_connects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, "rabbitmq_url", "amqp://first,amqp://second")

    class Connection:
        def __init__(self, _row) -> None:
            raise OSError("down")

    monkeypatch.setattr(main.pika, "URLParameters", _BrokerParameters)
    monkeypatch.setattr(main.pika, "BlockingConnection", Connection)

    assert main._broker_ok() is False
