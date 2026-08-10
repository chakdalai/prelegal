from types import SimpleNamespace

import app.document_llm as document_llm
import app.llm_common as llm_common
from app.document_fields import load_document_config, turn_result_model

CONFIG = load_document_config("cloud-service-agreement")
EMPTY_PARTY = {"company": "", "signatoryName": "", "signatoryTitle": "", "noticeAddress": ""}
RESULT_MODEL = turn_result_model("cloud-service-agreement")


def fields_body() -> dict:
    return {
        "values": {field.name: "" for field in CONFIG.fields},
        "party1": EMPTY_PARTY,
        "party2": EMPTY_PARTY,
    }


def request_body(message: str) -> dict:
    return {"messages": [{"role": "user", "content": message}], "fields": fields_body()}


def fake_completion(content: str):
    def _completion(*args, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return _completion


def test_chat_returns_reply_and_merges_the_patch(client, monkeypatch):
    monkeypatch.setattr(
        document_llm,
        "complete_with_retry",
        lambda *args, **kwargs: RESULT_MODEL(
            reply="Got it.", patch={"values": {"governingLaw": "Delaware"}}
        ),
    )

    response = client.post(
        "/api/documents/cloud-service-agreement/chat",
        json=request_body("Governing law is Delaware."),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Got it."
    assert body["fields"]["values"]["governingLaw"] == "Delaware"
    # Untouched fields survive the round trip unchanged.
    assert body["fields"]["values"]["subscriptionPeriod"] == ""


def test_chat_patch_can_set_a_single_party_field(client, monkeypatch):
    monkeypatch.setattr(
        document_llm,
        "complete_with_retry",
        lambda *args, **kwargs: RESULT_MODEL(
            reply="Noted.", patch={"party1": {"company": "Acme, Inc."}}
        ),
    )

    response = client.post(
        "/api/documents/cloud-service-agreement/chat",
        json=request_body("Party 1 is Acme, Inc."),
    )

    body = response.json()
    assert body["fields"]["party1"]["company"] == "Acme, Inc."
    assert body["fields"]["party1"]["signatoryName"] == ""


def test_chat_returns_404_for_an_unknown_document(client):
    response = client.post(
        "/api/documents/not-a-real-document/chat",
        json=request_body("Hello"),
    )

    assert response.status_code == 404


def test_chat_returns_502_when_the_llm_call_fails(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise document_llm.LlmUnavailableError("provider unavailable")

    monkeypatch.setattr(document_llm, "complete_with_retry", _raise)

    response = client.post(
        "/api/documents/cloud-service-agreement/chat", json=request_body("Hello")
    )

    assert response.status_code == 502


def test_chat_returns_502_when_the_response_does_not_validate(client, monkeypatch):
    # Exercises the real `complete_with_retry`, so its own validation-error
    # handling (not just the router's) is covered: a malformed Structured
    # Outputs response must collapse to the same 502 as a network failure,
    # not an uncaught validation error.
    monkeypatch.setattr(llm_common, "completion", fake_completion("not valid json"))

    response = client.post(
        "/api/documents/cloud-service-agreement/chat", json=request_body("Hello")
    )

    assert response.status_code == 502


def test_chat_rejects_malformed_request(client):
    response = client.post(
        "/api/documents/cloud-service-agreement/chat",
        json={"messages": [], "fields": {}},
    )

    assert response.status_code == 422


def test_system_prompt_always_asks_a_follow_up_question_when_fields_are_missing():
    from app.document_fields import fields_model

    current = fields_model("cloud-service-agreement")(**fields_body())
    prompt = document_llm._system_prompt(CONFIG, current)

    assert "follow-up question" in prompt
    assert "never end a turn" in prompt
