def test_signup_creates_user(client):
    response = client.post("/api/auth/signup", json={"email": "new@example.com"})
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["id"]


def test_signup_rejects_existing_email(client):
    client.post("/api/auth/signup", json={"email": "repeat@example.com"})
    response = client.post("/api/auth/signup", json={"email": "repeat@example.com"})
    assert response.status_code == 409


def test_signup_normalizes_email_case_and_whitespace(client):
    response = client.post("/api/auth/signup", json={"email": "  Case@Example.com  "})
    assert response.status_code == 201
    assert response.json()["email"] == "case@example.com"


def test_signup_rejects_invalid_email(client):
    response = client.post("/api/auth/signup", json={"email": "not-an-email"})
    assert response.status_code == 422


def test_login_succeeds_for_existing_user(client):
    created = client.post("/api/auth/signup", json={"email": "known@example.com"})
    response = client.post("/api/auth/login", json={"email": "known@example.com"})
    assert response.status_code == 200
    assert response.json()["id"] == created.json()["id"]


def test_login_rejects_unknown_email(client):
    response = client.post("/api/auth/login", json={"email": "nobody@example.com"})
    assert response.status_code == 404


def test_login_normalizes_email_case_and_whitespace(client):
    client.post("/api/auth/signup", json={"email": "case2@example.com"})
    response = client.post("/api/auth/login", json={"email": "  Case2@Example.com  "})
    assert response.status_code == 200
    assert response.json()["email"] == "case2@example.com"


def test_login_rejects_invalid_email(client):
    response = client.post("/api/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
