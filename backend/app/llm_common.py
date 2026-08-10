"""Shared Cerebras/OpenRouter plumbing for the chat features added after the
Mutual NDA (`document_llm.py`'s per-document chat, `routing_llm.py`'s
dashboard triage chat). The retry policy and error type are identical to
`llm.py`'s — see its module docstring and CLAUDE.md's AI design notes for why
retries are one-shot and only for genuinely transient error classes.

`llm.py` itself is deliberately left untouched rather than refactored onto
this module: it is the one chat feature already verified against the real
Cerebras API with dedicated retry tests, and this module's only job is to
avoid duplicating that logic between the two *new* call sites.
"""

import logging
import time

from litellm import (
    APIConnectionError,
    InternalServerError,
    RateLimitError,
    ServiceUnavailableError,
    Timeout,
    completion,
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)

RETRYABLE_ERRORS = (
    RateLimitError,
    APIConnectionError,
    InternalServerError,
    ServiceUnavailableError,
    Timeout,
)
RETRY_DELAY_SECONDS = 3

MODEL = "openrouter/openai/gpt-oss-120b"

EXTRA_BODY = {
    "provider": {
        "order": ["cerebras"],
        "allow_fallbacks": False,
        "require_parameters": True,
    }
}


class LlmUnavailableError(Exception):
    """The LLM call failed, or returned something that didn't validate."""


def complete_with_retry(
    llm_messages: list[dict], response_format: type[BaseModel], *, log_context: str
) -> BaseModel:
    """Calls the LLM with Structured Outputs, retrying once after a short
    fixed delay for transient failures, and returns the response validated
    against `response_format`. Validation happens inside the same try/except
    as the call itself (as `llm.py`'s `generate_turn` does) — a malformed
    Structured Outputs response is exactly as much "the LLM call failed" as a
    network error, and both must collapse to the same `LlmUnavailableError`
    rather than an uncaught validation error reaching the client as a 500.
    """

    def _complete():
        return completion(
            model=MODEL,
            messages=llm_messages,
            response_format=response_format,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )

    try:
        try:
            response = _complete()
        except RETRYABLE_ERRORS:
            time.sleep(RETRY_DELAY_SECONDS)
            response = _complete()

        return response_format.model_validate_json(response.choices[0].message.content)
    except Exception as error:
        logger.exception(log_context)
        raise LlmUnavailableError(str(error)) from error
