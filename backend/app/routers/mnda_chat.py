from fastapi import APIRouter, HTTPException

from app.llm import LlmUnavailableError, generate_turn
from app.mnda_schema import merge_patch
from app.models import MndaChatRequest, MndaChatResponse

router = APIRouter()


@router.post("/mnda/chat", response_model=MndaChatResponse)
def chat(payload: MndaChatRequest) -> MndaChatResponse:
    """One turn of the Mutual NDA chat. Stateless: the caller sends the full
    conversation transcript and current field snapshot each time, and gets
    back an assistant reply plus the new full snapshot with the LLM's patch
    merged in.
    """
    try:
        result = generate_turn(payload.messages, payload.fields)
    except LlmUnavailableError as error:
        raise HTTPException(
            status_code=502,
            detail="The assistant is temporarily unavailable. You can keep filling in the form directly.",
        ) from error

    return MndaChatResponse(
        reply=result.reply,
        fields=merge_patch(payload.fields, result.patch),
    )
