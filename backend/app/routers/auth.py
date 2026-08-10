import sqlite3
from uuid import uuid4

from fastapi import APIRouter, Request

from app.models import LoginRequest, LoginResponse

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request) -> LoginResponse:
    """Upsert a user by email. There is no password check: this is a fake
    login screen that exercises the real stack (frontend -> API -> SQLite)
    without any actual authentication yet.
    """
    conn = sqlite3.connect(request.app.state.db_path)
    try:
        conn.execute(
            "INSERT INTO users (id, email) VALUES (?, ?) "
            "ON CONFLICT(email) DO NOTHING",
            (str(uuid4()), payload.email),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, email FROM users WHERE email = ?", (payload.email,)
        ).fetchone()
    finally:
        conn.close()
    return LoginResponse(id=row[0], email=row[1])
