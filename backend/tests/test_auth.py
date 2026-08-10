def test_login_creates_user(client):
    response = client.post("/api/auth/login", json={"email": "new@example.com"})
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["id"]


def test_login_upserts_by_email(client):
    first = client.post("/api/auth/login", json={"email": "repeat@example.com"})
    second = client.post("/api/auth/login", json={"email": "repeat@example.com"})
    assert first.json()["id"] == second.json()["id"]


def test_login_normalizes_email_case_and_whitespace(client):
    response = client.post("/api/auth/login", json={"email": "  Case@Example.com  "})
    assert response.status_code == 200
    assert response.json()["email"] == "case@example.com"


def test_login_rejects_invalid_email(client):
    response = client.post("/api/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
