from fastapi import APIRouter, HTTPException

from app.models import RoutingChatRequest, RoutingChatResponse
from app.routing_llm import LlmUnavailableError, generate_turn

router = APIRouter()


@router.post("/documents/route", response_model=RoutingChatResponse)
def route(payload: RoutingChatRequest) -> RoutingChatResponse:
    """One turn of the dashboard's "not sure which document?" chat: maps a
    free-form description of the user's deal to the closest catalog
    document. Stateless, as the document chats: the caller sends the full
    transcript each time.
    """
    try:
        result = generate_turn(payload.messages)
    except LlmUnavailableError as error:
        raise HTTPException(
            status_code=502,
            detail="The assistant is temporarily unavailable. Browse the documents below instead.",
        ) from error

    return RoutingChatResponse(reply=result.reply, suggestedFilename=result.suggestedFilename)
