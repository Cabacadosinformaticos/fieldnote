from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _scrape() -> str:
    response = client.get("/api/v1/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    return response.text


def test_metrics_exposes_the_required_series() -> None:
    client.get("/api/v1/health")
    body = _scrape()

    for series in (
        "fieldnote_api_requests_total",
        "fieldnote_api_request_duration_seconds_bucket",
        "fieldnote_entries_created",
        "fieldnote_outbox_backlog",
        "fieldnote_database_up",
    ):
        assert series in body


def test_database_is_reported_reachable() -> None:
    assert "fieldnote_database_up 1.0" in _scrape()


def test_requests_are_counted_by_route_and_status() -> None:
    assert client.get("/api/v1/health").status_code == 200

    body = _scrape()

    assert 'fieldnote_api_requests_total{method="GET",route="/api/v1/health",status="200"}' in body
    assert (
        "fieldnote_api_request_duration_seconds_count"
        '{method="GET",route="/api/v1/health",status="200"}' in body
    )


def test_the_scrape_endpoint_does_not_count_itself() -> None:
    _scrape()

    assert 'route="/api/v1/metrics"' not in _scrape()


def test_unknown_routes_are_labelled_without_the_raw_path() -> None:
    assert client.get("/api/v1/does-not-exist").status_code == 404

    body = _scrape()

    assert 'route="unmatched",status="404"' in body
    assert 'route="/api/v1/does-not-exist"' not in body
