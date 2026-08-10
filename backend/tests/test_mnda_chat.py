import json
from types import SimpleNamespace

import app.llm as llm

FIELDS = {
    "purpose": "Evaluate a deal.",
    "effectiveDate": "",
    "mndaTerm": {"kind": "expires", "years": 1},
    "confidentialityTerm": {"kind": "years", "years": 1},
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "party1": {"company": "", "signatoryName": "", "signatoryTitle": "", "noticeAddress": ""},
    "party2": {"company": "", "signatoryName": "", "signatoryTitle": "", "noticeAddress": ""},
}


def fake_completion(content: str):
    def _completion(*args, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return _completion


def request_body(message: str) -> dict:
    return {"messages": [{"role": "user", "content": message}], "fields": FIELDS}


def test_chat_returns_reply_and_merges_the_patch(client, monkeypatch):
    monkeypatch.setattr(
        llm,
        "completion",
        fake_completion(
            json.dumps(
                {
                    "reply": "Got it, governing law is Delaware.",
                    "patch": {"governingLaw": "Delaware"},
                }
            )
        ),
    )

    response = client.post("/api/mnda/chat", json=request_body("Governing law is Delaware."))

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Got it, governing law is Delaware."
    assert body["fields"]["governingLaw"] == "Delaware"
    # Untouched fields survive the round trip unchanged.
    assert body["fields"]["purpose"] == FIELDS["purpose"]


def test_chat_patch_can_set_a_single_party_field(client, monkeypatch):
    monkeypatch.setattr(
        llm,
        "completion",
        fake_completion(
            json.dumps({"reply": "Noted.", "patch": {"party1": {"company": "Acme, Inc."}}})
        ),
    )

    response = client.post("/api/mnda/chat", json=request_body("Party 1 is Acme, Inc."))

    body = response.json()
    assert body["fields"]["party1"]["company"] == "Acme, Inc."
    assert body["fields"]["party1"]["signatoryName"] == ""


def test_chat_returns_502_when_the_llm_call_fails(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(llm, "completion", _raise)

    response = client.post("/api/mnda/chat", json=request_body("Hello"))

    assert response.status_code == 502


def test_chat_returns_502_when_the_response_does_not_validate(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", fake_completion("not valid json"))

    response = client.post("/api/mnda/chat", json=request_body("Hello"))

    assert response.status_code == 502


def test_chat_rejects_malformed_request(client):
    response = client.post("/api/mnda/chat", json={"messages": [], "fields": {}})

    assert response.status_code == 422
