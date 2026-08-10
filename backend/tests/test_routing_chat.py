from types import SimpleNamespace

import app.llm_common as llm_common
import app.routing_llm as routing_llm


def fake_completion(content: str):
    def _completion(*args, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return _completion


def test_route_suggests_the_closest_document(client, monkeypatch):
    monkeypatch.setattr(
        routing_llm,
        "complete_with_retry",
        lambda *args, **kwargs: routing_llm.RoutingTurnResult(
            reply="The Cloud Service Agreement is the closest fit.",
            suggestedFilename="cloud-service-agreement.md",
        ),
    )

    response = client.post(
        "/api/documents/route",
        json={"messages": [{"role": "user", "content": "We're building a SaaS product."}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["suggestedFilename"] == "cloud-service-agreement.md"
    assert "Cloud Service Agreement" in body["reply"]


def test_route_can_return_no_suggestion_yet(client, monkeypatch):
    monkeypatch.setattr(
        routing_llm,
        "complete_with_retry",
        lambda *args, **kwargs: routing_llm.RoutingTurnResult(
            reply="What kind of deal is this for?", suggestedFilename=None
        ),
    )

    response = client.post("/api/documents/route", json={"messages": [{"role": "user", "content": "Hi"}]})

    assert response.status_code == 200
    assert response.json()["suggestedFilename"] is None


def test_route_returns_502_when_the_llm_call_fails(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise routing_llm.LlmUnavailableError("provider unavailable")

    monkeypatch.setattr(routing_llm, "complete_with_retry", _raise)

    response = client.post("/api/documents/route", json={"messages": [{"role": "user", "content": "Hi"}]})

    assert response.status_code == 502


def test_route_returns_502_when_the_response_does_not_validate(client, monkeypatch):
    monkeypatch.setattr(llm_common, "completion", fake_completion("not valid json"))

    response = client.post("/api/documents/route", json={"messages": [{"role": "user", "content": "Hi"}]})

    assert response.status_code == 502


def test_catalog_summary_excludes_the_mutual_nda_standard_terms():
    # The Standard Terms are boilerplate incorporated by reference into the
    # Cover Page, not a starting point a user picks on their own — the router
    # must never suggest it.
    summary = routing_llm._load_catalog_summary()

    assert "mutual-nda.md" not in summary
    assert "mutual-nda-coverpage.md" in summary


def test_system_prompt_always_asks_a_follow_up_question_when_nothing_is_known_yet():
    prompt = routing_llm._system_prompt()

    assert "follow-up question" in prompt
    assert "never end a turn" in prompt
