"""Pydantic request/response shapes for the API."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.mnda_schema import MndaFields


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)

    @field_validator("email")
    @classmethod
    def looks_like_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("must be a valid email")
        return value


class LoginResponse(BaseModel):
    id: str
    email: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MndaChatRequest(BaseModel):
    messages: list[ChatMessage]
    fields: MndaFields


class MndaChatResponse(BaseModel):
    reply: str
    fields: MndaFields


class RoutingChatRequest(BaseModel):
    messages: list[ChatMessage]


class RoutingChatResponse(BaseModel):
    reply: str
    suggestedFilename: Optional[str] = None
