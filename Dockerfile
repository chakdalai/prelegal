# Build context must be the repository root: the frontend build reads
# ../templates, ../catalog.json, and ../document-fields relative to
# frontend/ (see frontend/README.md's "Deploying" section).

FROM node:22-alpine AS frontend-build
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
WORKDIR /repo
COPY templates ./templates
COPY catalog.json ./catalog.json
COPY document-fields ./document-fields
COPY frontend ./frontend
WORKDIR /repo/frontend
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY catalog.json ./catalog.json
COPY document-fields ./document-fields
COPY --from=frontend-build /repo/frontend/out ./static

ENV PRELEGAL_STATIC_DIR=/app/static
ENV PRELEGAL_DB_PATH=/app/data/prelegal.db
# The backend now reads these two repo-root files at runtime too (PL-6's
# per-document field configs, and catalog.json for the routing chat) — see
# `document_fields.py`/`routing_llm.py` for why the default `parents[2]`
# resolution (correct in local dev) doesn't reach them in this image layout.
ENV PRELEGAL_DOCUMENT_FIELDS_DIR=/app/document-fields
ENV PRELEGAL_CATALOG_PATH=/app/catalog.json

EXPOSE 8000
# --no-sync: dependencies are already installed at build time, so `uv run`
# should use them as-is rather than reaching out to re-resolve/install at
# every container start.
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
