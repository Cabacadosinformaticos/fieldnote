from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)

INDEX = '<!doctype html><div id="root">Fieldnote</div>'


@pytest.fixture
def dashboard(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('fieldnote')\n")
    (tmp_path / "index.html").write_text(INDEX)
    monkeypatch.setattr(main.settings, "dashboard_dir", str(tmp_path))
    return tmp_path


def test_root_serves_the_index(dashboard: Path) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert INDEX in response.text


def test_client_side_route_falls_back_to_the_index(dashboard: Path) -> None:
    response = client.get("/estudos/abc")

    assert response.status_code == 200
    assert INDEX in response.text


def test_admin_route_falls_back_to_the_index(dashboard: Path) -> None:
    response = client.get("/admin/users")

    assert response.status_code == 200
    assert INDEX in response.text


def test_asset_is_served(dashboard: Path) -> None:
    response = client.get("/assets/app.js")

    assert response.status_code == 200
    assert "console.log('fieldnote')" in response.text


def test_api_health_is_not_shadowed(dashboard: Path) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_path_keeps_the_api_404(dashboard: Path) -> None:
    response = client.get("/api/v1/unknown")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not Found"}}


def test_missing_dashboard_directory_keeps_unknown_paths_at_404(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main.settings, "dashboard_dir", str(tmp_path / "absent"))

    response = client.get("/estudos/abc")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not Found"}}


def test_asset_is_served_with_a_relative_directory(
    dashboard: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The image sets the default "dashboard", relative to the working directory.
    monkeypatch.chdir(dashboard.parent)
    monkeypatch.setattr(main.settings, "dashboard_dir", dashboard.name)
    response = client.get("/assets/app.js")
    assert response.status_code == 200
    assert "fieldnote" in response.text


def test_missing_asset_is_a_404_not_the_index(dashboard: Path) -> None:
    response = client.get("/assets/gone.js")
    assert response.status_code == 404


def test_cache_headers(dashboard: Path) -> None:
    assert client.get("/").headers["cache-control"] == "no-store"
    assert "immutable" in client.get("/assets/app.js").headers["cache-control"]
