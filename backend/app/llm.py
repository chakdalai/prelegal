"""Calls the LLM that drives the Mutual NDA chat, via Cerebras/OpenRouter.

Follows .claude/skills/cerebras/SKILL.md exactly: LiteLLM, the
openrouter/openai/gpt-oss-120b model, Cerebras pinned as the sole provider,
and Structured Outputs parsed with `model_validate_json`.
"""

import logging
from datetime import date

from litellm import completion

logger = logging.getLogger(__name__)

from app.mnda_schema import MndaFields, MndaTurnResult
from app.models import ChatMessage

MODEL = "openrouter/openai/gpt-oss-120b"

EXTRA_BODY = {
    "provider": {
        "order": ["cerebras"],
        "allow_fallbacks": False,
        "require_parameters": True,
    }
}

# Field descriptions are lifted from templates/mutual-nda-coverpage.md's own
# <label> text, so the assistant and the document never disagree about what
# a field means.
SYSTEM_PROMPT_TEMPLATE = """\
You are helping a user fill in the Cover Page of a Common Paper Mutual \
Non-Disclosure Agreement through free-form conversation, instead of a \
form. You are not a lawyer: if asked for legal advice, say you can't give \
it and continue collecting the deal's facts.

The Cover Page has these fields:
- purpose: how Confidential Information may be used.
- effectiveDate: the agreement's effective date, as an ISO yyyy-mm-dd date. \
Today's date is {today}.
- mndaTerm: the length of the MNDA itself. Either {{"kind": "expires", \
"years": N}} or {{"kind": "untilTerminated"}}.
- confidentialityTerm: how long Confidential Information stays protected. \
Either {{"kind": "years", "years": N}} or {{"kind": "perpetual"}}.
- governingLaw: the state whose law governs, e.g. "Delaware".
- jurisdiction: the city/county and state whose courts hear disputes, e.g. \
"New Castle, DE".
- modifications: any changes to the standard terms. Optional; most \
agreements have none.
- party1 / party2: each has company, signatoryName, signatoryTitle, and \
noticeAddress (an email or postal address).

The fields already known for this conversation are:
{current_fields_json}

Rules:
- Only set a field in `patch` if the user's messages newly determined or \
corrected its value this turn. Leave every other field null — never \
restate a value that's already known and unchanged.
- Never invent or guess a value, especially governing law, jurisdiction, or \
a party's legal name. Ask instead.
- Ask about a few related fields at a time, in a natural order, rather \
than listing all of them at once.
- Acknowledge values the user just gave you, and mention when everything \
needed for a complete agreement has been gathered.
- `reply` is the message shown to the user; write it directly to them.
"""


class LlmUnavailableError(Exception):
    """The LLM call failed, or returned something that didn't validate."""


def _system_prompt(current_fields: MndaFields) -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(
        today=date.today().isoformat(),
        current_fields_json=current_fields.model_dump_json(),
    )


def generate_turn(messages: list[ChatMessage], current_fields: MndaFields) -> MndaTurnResult:
    llm_messages = [
        {"role": "system", "content": _system_prompt(current_fields)},
        *({"role": message.role, "content": message.content} for message in messages),
    ]

    try:
        response = completion(
            model=MODEL,
            messages=llm_messages,
            response_format=MndaTurnResult,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        return MndaTurnResult.model_validate_json(response.choices[0].message.content)
    except Exception as error:
        # The router only ever surfaces a fixed, generic 502 message to the
        # client (an upstream rate limit, a network error, and a malformed
        # structured-output response all look the same from there) — log the
        # real cause here so it's diagnosable from the server logs.
        logger.exception("Mutual NDA chat turn failed")
        raise LlmUnavailableError(str(error)) from error
