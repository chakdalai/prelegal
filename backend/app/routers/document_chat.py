from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from app.document_fields import fields_model, load_document_config, merge_patch
from app.document_llm import LlmUnavailableError, generate_turn
from app.models import ChatMessage

router = APIRouter()


@router.post("/documents/{slug}/chat")
async def chat(slug: str, request: Request) -> dict:
    """One turn of a generic document's chat (every catalog document except
    the Mutual NDA — see `routers/mnda_chat.py` for that one). Stateless, as
    the Mutual NDA chat: the caller sends the full transcript and current
    field snapshot each time.

    The request/response shape is validated by hand against the per-slug
    dynamic model (`document_fields.fields_model`) rather than declared as a
    FastAPI `response_model`, since that model's fields differ per document.
    """
    config = load_document_config(slug)
    if config is None:
        raise HTTPException(status_code=404, detail=f"Unknown document {slug!r}")

    body = await request.json()

    try:
        messages = [ChatMessage.model_validate(item) for item in body.get("messages", [])]
        current_fields = fields_model(slug).model_validate(body.get("fields", {}))
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        result = generate_turn(slug, messages, current_fields)
    except LlmUnavailableError as error:
        raise HTTPException(
            status_code=502,
            detail="The assistant is temporarily unavailable. You can keep filling in the form directly.",
        ) from error

    merged = merge_patch(slug, current_fields, result.patch)
    return {"reply": result.reply, "fields": merged.model_dump()}
