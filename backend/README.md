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
database is created. `PRELEGAL_DOCUMENT_FIELDS_DIR` and `PRELEGAL_CATALOG_PATH` locate the
`document-fields/` directory and `catalog.json` the generic document chat and the routing chat
read at runtime — both default to their real location two directories up from `app/` (the repo
root), which is correct when running from a full repo checkout. They only need overriding in a
deployment where the backend isn't (the Docker image sets both explicitly; see the root
`Dockerfile`). `OPENROUTER_API_KEY` (loaded from the repo-root `.env`, see `app/config.py`) is
required for any of the three chat endpoints below to work — every other route runs fine without it.

## Database

SQLite, recreated from scratch on every startup (see `app/db.py`) — there is no migration story
because there is nothing to migrate yet. This is intentional: the database is temporary per
CLAUDE.md. Two tables: `users` (email, inserted at signup — rejected with a 409 if it already
exists) and, as of PL-7, `documents` (a saved
document per autosave, scoped to `user_id`) — both wiped and recreated on every boot along with
everything else.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/auth/signup` | Registers a user by email (no password check — there is no real authentication yet); 409 if the email already has an account |
| `POST` | `/api/auth/login` | Signs in an existing user by email; 404 if no account exists for it |
| `POST` | `/api/mnda/chat` | One stateless Mutual NDA chat turn — see `app/llm.py` and `app/mnda_schema.py` |
| `POST` | `/api/documents/{slug}/chat` | As above, generalized to every other catalog document with a builder — see `app/document_llm.py` and `app/document_fields.py`. 404 if `slug` has no `document-fields/*.json` config |
| `POST` | `/api/documents/route` | One stateless routing-chat turn: maps a free-form description to the closest catalog document — see `app/routing_llm.py` |
| `PUT` | `/api/saved-documents/{id}` | Autosave upsert: creates or updates a saved document by client-generated id — see `app/routers/documents.py` |
| `GET` | `/api/saved-documents` | Lists a user's saved documents (`?userId=`), most recently updated first |
| `GET` | `/api/saved-documents/{id}` | Fetches one saved document (`?userId=`); 404 if missing or owned by a different user |

## Testing

```bash
uv run pytest
```

`tests/conftest.py` builds a fresh app per test against a `tmp_path` database and an empty static
directory, so these tests never depend on a frontend build.
