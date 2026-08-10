import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "test.db"
    static_dir = tmp_path / "static"  # left empty: no frontend build needed for backend tests
    app = create_app(db_path, static_dir)
    with TestClient(app) as test_client:
        yield test_client
