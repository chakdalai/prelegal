def _signup(client, email="drafter@example.com"):
    return client.post("/api/auth/signup", json={"email": email}).json()["id"]


def test_save_document_creates_a_new_row(client):
    user_id = _signup(client)
    response = client.put(
        "/api/saved-documents/doc-1",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Mutual NDA",
            "formData": {"purpose": "Evaluating a partnership"},
            "markdown": "# Mutual NDA\n\n...",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "doc-1"
    assert body["title"] == "Mutual NDA"
    assert body["formData"] == {"purpose": "Evaluating a partnership"}
    assert body["createdAt"] == body["updatedAt"]


def test_save_document_upserts_the_same_id(client):
    user_id = _signup(client)
    first = client.put(
        "/api/saved-documents/doc-2",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Mutual NDA",
            "formData": {"purpose": "First draft"},
            "markdown": "first",
        },
    ).json()
    second = client.put(
        "/api/saved-documents/doc-2",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Mutual NDA",
            "formData": {"purpose": "Updated draft"},
            "markdown": "second",
        },
    ).json()
    assert second["id"] == first["id"]
    assert second["formData"] == {"purpose": "Updated draft"}
    assert second["markdown"] == "second"

    listed = client.get("/api/saved-documents", params={"userId": user_id}).json()
    assert len(listed) == 1


def test_save_document_rejects_overwriting_a_different_owners_id(client):
    owner = _signup(client, "owner@example.com")
    other = _signup(client, "other@example.com")
    client.put(
        "/api/saved-documents/doc-owned",
        json={
            "userId": owner,
            "slug": "mutual-nda",
            "title": "Owner's NDA",
            "formData": {},
            "markdown": "original",
        },
    )

    response = client.put(
        "/api/saved-documents/doc-owned",
        json={
            "userId": other,
            "slug": "mutual-nda",
            "title": "Hijacked",
            "formData": {},
            "markdown": "hijacked",
        },
    )
    assert response.status_code == 404

    # The original document is untouched.
    original = client.get(
        "/api/saved-documents/doc-owned", params={"userId": owner}
    ).json()
    assert original["title"] == "Owner's NDA"
    assert original["markdown"] == "original"


def test_list_documents_is_scoped_to_user(client):
    user_a = _signup(client, "a@example.com")
    user_b = _signup(client, "b@example.com")
    client.put(
        "/api/saved-documents/doc-a",
        json={
            "userId": user_a,
            "slug": "mutual-nda",
            "title": "A's NDA",
            "formData": {},
            "markdown": "a",
        },
    )
    client.put(
        "/api/saved-documents/doc-b",
        json={
            "userId": user_b,
            "slug": "mutual-nda",
            "title": "B's NDA",
            "formData": {},
            "markdown": "b",
        },
    )

    response = client.get("/api/saved-documents", params={"userId": user_a})
    assert response.status_code == 200
    titles = [doc["title"] for doc in response.json()]
    assert titles == ["A's NDA"]


def test_list_documents_orders_most_recently_updated_first(client):
    user_id = _signup(client)
    client.put(
        "/api/saved-documents/older",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Older",
            "formData": {},
            "markdown": "older",
        },
    )
    client.put(
        "/api/saved-documents/newer",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Newer",
            "formData": {},
            "markdown": "newer",
        },
    )
    # Re-saving "older" should move it back to the front.
    client.put(
        "/api/saved-documents/older",
        json={
            "userId": user_id,
            "slug": "mutual-nda",
            "title": "Older",
            "formData": {},
            "markdown": "older, updated",
        },
    )

    response = client.get("/api/saved-documents", params={"userId": user_id})
    ids = [doc["id"] for doc in response.json()]
    assert ids[0] == "older"


def test_get_document_returns_full_detail(client):
    user_id = _signup(client)
    client.put(
        "/api/saved-documents/doc-3",
        json={
            "userId": user_id,
            "slug": "cloud-service-agreement",
            "title": "Cloud Service Agreement",
            "formData": {"effectiveDate": "2026-01-01"},
            "markdown": "# Cloud Service Agreement\n\n...",
        },
    )
    response = client.get(
        "/api/saved-documents/doc-3", params={"userId": user_id}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["markdown"] == "# Cloud Service Agreement\n\n..."
    assert body["formData"] == {"effectiveDate": "2026-01-01"}


def test_get_document_404s_when_missing(client):
    user_id = _signup(client)
    response = client.get(
        "/api/saved-documents/does-not-exist", params={"userId": user_id}
    )
    assert response.status_code == 404


def test_get_document_404s_for_a_different_owner(client):
    user_a = _signup(client, "owner@example.com")
    user_b = _signup(client, "other@example.com")
    client.put(
        "/api/saved-documents/doc-4",
        json={
            "userId": user_a,
            "slug": "mutual-nda",
            "title": "Owner's NDA",
            "formData": {},
            "markdown": "owner",
        },
    )
    response = client.get(
        "/api/saved-documents/doc-4", params={"userId": user_b}
    )
    assert response.status_code == 404
