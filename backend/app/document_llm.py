"""Calls the LLM that drives a generic document's chat (PL-6) — every catalog
document except the Mutual NDA, which keeps its own `llm.py`. Structured
Outputs schema and field descriptions are built per-document from
`document_fields.py`'s config-driven models, rather than hand-written like
`llm.py`'s `SYSTEM_PROMPT_TEMPLATE`.
"""

from datetime import date

from app.document_fields import DocumentConfig, load_document_config, turn_result_model
from app.llm_common import LlmUnavailableError, complete_with_retry
from app.models import ChatMessage

__all__ = ["LlmUnavailableError", "generate_turn"]

SYSTEM_PROMPT_TEMPLATE = """\
You are helping a user fill in the Cover Page of a Common Paper {title} \
through free-form conversation, instead of a form. You are not a lawyer: if \
asked for legal advice, say you can't give it and continue collecting the \
deal's facts.

The Cover Page has these fields:
{field_descriptions}
- party1 ({party1_label}) / party2 ({party2_label}): each has company, \
signatoryName, signatoryTitle, and noticeAddress (an email or postal \
address).

Today's date is {today}, for any field that is a date.

The fields already known for this conversation are:
{current_fields_json}

Rules:
- Only set a field in `patch` if the user's messages newly determined or \
corrected its value this turn. Leave every other field null — never \
restate a value that's already known and unchanged.
- Never invent or guess a value. Ask instead.
- Ask about a few related fields at a time, in a natural order, rather than \
listing all of them at once.
- Acknowledge values the user just gave you.
- If anything needed for a complete agreement is still missing, `reply` \
must end with a specific follow-up question about one of the missing \
fields — never end a turn on just an acknowledgement when fields remain \
outstanding. Only skip the question once every field is known, in which \
case say so instead.
- `reply` is the message shown to the user; write it directly to them.
"""


def _field_descriptions(config: DocumentConfig) -> str:
    lines = [f"- {field.name}: {field.label}" for field in config.fields]
    return "\n".join(lines)


def _system_prompt(config: DocumentConfig, current_fields) -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(
        title=config.title,
        field_descriptions=_field_descriptions(config),
        party1_label=config.party1Label,
        party2_label=config.party2Label,
        today=date.today().isoformat(),
        current_fields_json=current_fields.model_dump_json(),
    )


def generate_turn(slug: str, messages: list[ChatMessage], current_fields):
    """One turn of a generic document's chat. Raises `LlmUnavailableError` if
    the slug has no config, the LLM call fails, or the response doesn't
    validate.
    """
    config = load_document_config(slug)
    if config is None:
        raise LlmUnavailableError(f"no document config for slug {slug!r}")

    llm_messages = [
        {"role": "system", "content": _system_prompt(config, current_fields)},
        *({"role": message.role, "content": message.content} for message in messages),
    ]

    result_model = turn_result_model(slug)
    return complete_with_retry(
        llm_messages, result_model, log_context=f"Document chat turn failed ({slug})"
    )
