import sqlite3
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.models import LoginRequest, LoginResponse

router = APIRouter()


@router.post("/auth/signup", response_model=LoginResponse, status_code=201)
def signup(payload: LoginRequest, request: Request) -> LoginResponse:
    """Register a new user. There is still no password: this stays a
    passwordless account model, but signup and sign-in are no longer the
    same operation — signup now rejects an email that already has an
    account instead of silently upserting it.
    """
    conn = sqlite3.connect(request.app.state.db_path)
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (payload.email,)
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Try signing in instead.",
            )
        user_id = str(uuid4())
        conn.execute(
            "INSERT INTO users (id, email) VALUES (?, ?)", (user_id, payload.email)
        )
        conn.commit()
    finally:
        conn.close()
    return LoginResponse(id=user_id, email=payload.email)


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request) -> LoginResponse:
    """Sign in an existing user by email. There is no password check: this
    is a fake login screen that exercises the real stack (frontend -> API ->
    SQLite) without any actual authentication yet.
    """
    conn = sqlite3.connect(request.app.state.db_path)
    try:
        row = conn.execute(
            "SELECT id, email FROM users WHERE email = ?", (payload.email,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(
            status_code=404,
            detail="No account found for this email. Try signing up instead.",
        )
    return LoginResponse(id=row[0], email=row[1])
