# Prelegal backend

FastAPI backend, managed with [uv](https://docs.astral.sh/uv/). Serves the API and, in Docker,
the statically-exported frontend.

## Getting started

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Then open <http://localhost:8000/health>. `PRELEGAL_STATIC_DIR` (default `static/`) controls where
the exported frontend is served from; if the directory doesn't exist, the backend still runs with
just its API routes. `PRELEGAL_DB_PATH` (default `data/prelegal.db`) controls where the SQLite
database is created. `OPENROUTER_API_KEY` (loaded from the repo-root `.env`, see `app/config.py`)
is required for the Mutual NDA chat endpoint to work — every other route runs fine without it.

## Database

SQLite, recreated from scratch on every startup (see `app/db.py`) — there is no migration story
because there is nothing to migrate yet. This is intentional: the database is temporary per
CLAUDE.md, not a persistence layer for user data yet.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/auth/login` | Upserts a user by email (no password check — there is no real authentication yet) and returns their id |
| `POST` | `/api/mnda/chat` | One stateless Mutual NDA chat turn — see `app/llm.py` and `app/mnda_schema.py` |

## Testing

```bash
uv run pytest
```

`tests/conftest.py` builds a fresh app per test against a `tmp_path` database and an empty static
directory, so these tests never depend on a frontend build.
