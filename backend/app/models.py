"""Pydantic request/response shapes for the API."""

from pydantic import BaseModel, Field, field_validator


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
