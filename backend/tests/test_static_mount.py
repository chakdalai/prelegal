from app.main import create_app
from fastapi.testclient import TestClient


def test_serves_static_index(tmp_path):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>hello</html>")

    app = create_app(tmp_path / "test.db", static_dir)
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert "hello" in response.text


def test_api_routes_are_not_shadowed_by_static_mount(tmp_path):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>hello</html>")

    app = create_app(tmp_path / "test.db", static_dir)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.post("/api/auth/signup", json={"email": "a@b.com"}).status_code == 201


def test_runs_without_a_static_build(tmp_path):
    """No frontend build present: the app still boots and the API still works."""
    app = create_app(tmp_path / "test.db", tmp_path / "static")
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
