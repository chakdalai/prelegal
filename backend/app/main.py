import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import load_env
from app.db import init_db
from app.routers import auth, document_chat, documents, health, mnda_chat, routing_chat


def create_app(db_path: Path, static_dir: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(db_path)
        yield

    app = FastAPI(lifespan=lifespan)
    app.state.db_path = db_path

    # Routers must be registered before the static mount below: Starlette
    # matches routes in registration order, and the mount is a catch-all at
    # "/" that would otherwise shadow /api/* and /health.
    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api")
    app.include_router(mnda_chat.router, prefix="/api")
    app.include_router(document_chat.router, prefix="/api")
    app.include_router(routing_chat.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")

    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


load_env()

DB_PATH = Path(os.environ.get("PRELEGAL_DB_PATH", "data/prelegal.db"))
STATIC_DIR = Path(os.environ.get("PRELEGAL_STATIC_DIR", "static"))

app = create_app(DB_PATH, STATIC_DIR)
