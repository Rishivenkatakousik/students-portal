"""The built React app is served by FastAPI without shadowing the API."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path) -> TestClient:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Results Portal</title>")
    (dist / "assets" / "index-abc123.js").write_text("console.log('app')")
    (dist / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("outside dist")
    return TestClient(create_app(frontend_dist=dist))


@pytest.mark.parametrize("path", ["/", "/students", "/students/STU00001", "/import", "/no/such/page"])
def test_app_routes_return_index_html(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert "<title>Results Portal</title>" in response.text
    assert response.headers["cache-control"] == "no-cache"


def test_assets_and_top_level_files_are_served(client):
    assert client.get("/assets/index-abc123.js").text == "console.log('app')"
    assert client.get("/favicon.svg").text == "<svg/>"
    assert client.get("/assets/missing.js").status_code == 404


def test_api_routes_win_over_the_frontend(client):
    assert client.get("/api/health").json() == {"status": "ok"}


@pytest.mark.parametrize("path", ["/api", "/api/", "/api/nope", "/api/students/x/y"])
def test_unknown_api_paths_are_json_404_not_the_app(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.parametrize("path", ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"])
def test_files_outside_dist_are_never_served(client, path):
    response = client.get(path)
    assert "outside dist" not in response.text


def test_without_a_built_frontend_the_api_still_works(tmp_path):
    client = TestClient(create_app(frontend_dist=tmp_path / "missing"))
    assert client.get("/api/health").status_code == 200
    response = client.get("/students")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "FRONTEND_NOT_BUILT"
    assert "npm run build" in response.json()["error"]["message"]


def test_a_frontend_built_after_startup_is_served(tmp_path):
    dist = tmp_path / "dist"
    client = TestClient(create_app(frontend_dist=dist))  # nothing built yet
    assert client.get("/students").status_code == 404

    (dist / "assets").mkdir(parents=True)  # now `npm run build` happens
    (dist / "index.html").write_text("<title>Results Portal</title>")
    (dist / "assets" / "app.js").write_text("ok")

    assert "Results Portal" in client.get("/students").text
    assert client.get("/assets/app.js").text == "ok"
