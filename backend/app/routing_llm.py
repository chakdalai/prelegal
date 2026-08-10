"""Calls the LLM behind the dashboard's "not sure which document?" chat
(PL-6): maps a user's free-form description of their deal to the closest
document in catalog.json, so a user who doesn't already know Prelegal's
document names can still get to the right builder. Explicitly in scope per
PL-6: "engage with the user if they want an unsupported document; explain
that we can't generate that, but offer the closest document that can."
"""

import json
import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

from app.llm_common import LlmUnavailableError, complete_with_retry
from app.models import ChatMessage

__all__ = ["LlmUnavailableError", "RoutingTurnResult", "generate_turn"]

# See `document_fields.py`'s `DOCUMENT_FIELDS_DIR` for why this needs a
# Docker-specific override (`PRELEGAL_CATALOG_PATH`) rather than always
# resolving `parents[2]`.
CATALOG_PATH = Path(
    os.environ.get("PRELEGAL_CATALOG_PATH") or Path(__file__).resolve().parents[2] / "catalog.json"
)

# The Standard Terms are boilerplate incorporated by reference into the
# Mutual NDA Cover Page, not something a user starts on their own — the
# dashboard's own card grid excludes it from being clickable for the same
# reason (see frontend `Dashboard`'s `LIVE_FILENAME`), so the router must
# never suggest it as a starting point either.
EXCLUDED_FILENAMES = {"mutual-nda.md"}


class RoutingTurnResult(BaseModel):
    reply: str
    # A catalog entry's `filename`, or None if there isn't enough
    # information yet to suggest one.
    suggestedFilename: Optional[str] = None


def _load_catalog_summary() -> str:
    entries = json.loads(CATALOG_PATH.read_text())
    lines = [
        f"- {entry['filename']}: {entry['name']} — {entry['description']}"
        for entry in entries
        if entry["filename"] not in EXCLUDED_FILENAMES
    ]
    return "\n".join(lines)


SYSTEM_PROMPT_TEMPLATE = """\
You help a user figure out which legal agreement template to start drafting. \
You are not a lawyer: if asked for legal advice, say you can't give it and \
continue helping them find the right document.

The available documents are:
{catalog}

Rules:
- Only set `suggestedFilename` to one of the filenames listed above, exactly \
as written there. Never invent a filename.
- Set `suggestedFilename` to the closest available document as soon as the \
user has described enough about their situation to make a reasonable guess \
— even an imperfect match. Say plainly in `reply` when it's not an exact \
fit and briefly why, so the user can judge whether to use it anyway.
- Leave `suggestedFilename` null only when the user hasn't yet said enough \
about what they need. In that case `reply` must end with a specific \
follow-up question about their situation — never end a turn with nothing \
to go on and no question asked.
- `reply` is the message shown to the user; write it directly to them.
"""


def _system_prompt() -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(catalog=_load_catalog_summary())


def generate_turn(messages: list[ChatMessage]) -> RoutingTurnResult:
    llm_messages = [
        {"role": "system", "content": _system_prompt()},
        *({"role": message.role, "content": message.content} for message in messages),
    ]

    return complete_with_retry(
        llm_messages, RoutingTurnResult, log_context="Routing chat turn failed"
    )
