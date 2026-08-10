from types import SimpleNamespace

import pytest
from pydantic import BaseModel

import app.llm_common as llm_common


class Echo(BaseModel):
    reply: str


def fake_completion(content: str):
    def _completion(*args, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return _completion


def test_retries_once_after_a_rate_limit_and_then_succeeds(monkeypatch):
    monkeypatch.setattr(llm_common.time, "sleep", lambda seconds: None)
    calls = {"count": 0}

    def _completion(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise llm_common.RateLimitError(
                message="rate limited", llm_provider="openrouter", model=llm_common.MODEL
            )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"reply": "Got it."}'))]
        )

    monkeypatch.setattr(llm_common, "completion", _completion)

    result = llm_common.complete_with_retry([], Echo, log_context="test")

    assert result == Echo(reply="Got it.")
    assert calls["count"] == 2


def test_gives_up_after_the_retry_also_fails(monkeypatch):
    monkeypatch.setattr(llm_common.time, "sleep", lambda seconds: None)

    def _raise(*args, **kwargs):
        raise llm_common.RateLimitError(
            message="rate limited", llm_provider="openrouter", model=llm_common.MODEL
        )

    monkeypatch.setattr(llm_common, "completion", _raise)

    with pytest.raises(llm_common.LlmUnavailableError):
        llm_common.complete_with_retry([], Echo, log_context="test")


def test_does_not_retry_a_non_retryable_error(monkeypatch):
    calls = {"count": 0}

    def _raise(*args, **kwargs):
        calls["count"] += 1
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(llm_common, "completion", _raise)

    with pytest.raises(llm_common.LlmUnavailableError):
        llm_common.complete_with_retry([], Echo, log_context="test")

    assert calls["count"] == 1


def test_validation_error_becomes_llm_unavailable_error(monkeypatch):
    monkeypatch.setattr(llm_common, "completion", fake_completion("not valid json"))

    with pytest.raises(llm_common.LlmUnavailableError):
        llm_common.complete_with_retry([], Echo, log_context="test")
