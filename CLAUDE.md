# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation covers the Mutual NDA only, through a manual form rather than AI chat.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

Merges to `main` are squash merges, so each PR becomes one commit titled `... (#N)`.

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

The OPENROUTER_API_KEY belongs in a `.env` file in the project root. Not yet present — no code calls an LLM.

## Technical design

The entire project should be packaged into a Docker container.
The backend should be in backend/ and be a uv project, using FastAPI.
The frontend should be in frontend/
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.
Consider statically building the frontend and serving it via FastAPI, if that will work.
There should be scripts in scripts/ for:
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

Built (PL-4): `backend/` is a uv/FastAPI project; the SQLite `users` table is recreated from
scratch on every startup (`backend/app/db.py`); the frontend is statically exported
(`output: "export"`) and served by FastAPI (`StaticFiles`, mounted after the API routes so it
cannot shadow them); the six `scripts/` files build and run/stop a single Docker image. There is
only a fake login screen so far — `POST /api/auth/login` upserts a user by email with no password
check — so there is no real authentication yet. `npm run dev` in frontend/ still works for
frontend-only iteration, but login needs the backend on the same origin, which only Docker
provides.

### Agreement rendering rules

- **Standard Terms render verbatim.** `templates/mutual-nda.md` is incorporated into the agreement
  by reference, and the Cover Page declares it "identical to those posted at
  commonpaper.com/standards/mutual-nda/1.0". Never substitute a user's values into it: the
  published text carries the `coverpage_link` cross-references as defined terms. Substituting also
  breaks §9's second sentence, which becomes "the conflict of laws provisions of such Delaware".
  Deal-specific values belong on the Cover Page.
- **The CC BY 4.0 attribution must survive into every generated document.** It is a licence
  condition, not decoration.
- **Escape everything the user types** before it reaches the document. A `#` in a free-text field
  becomes a heading; a company name ending in `**` opens an emphasis span that runs on through the
  clauses that follow.
- `templates/` is the single source of truth for agreement text. Read from it rather than copying
  it into an app.
- `renderMnda` is pure and feeds the preview, the Markdown download and the print view. Keep it
  that way so the three cannot drift apart, and put new tests there first.

### Testing

```bash
cd frontend
npm test          # unit + component (Vitest)
npm run test:e2e  # Playwright; builds the static export first, so it cannot share
                  # a port with a running dev server

cd backend
uv run pytest     # FastAPI TestClient, isolated tmp_path database per test
```

`frontend/TESTING.md` records what the tests cover and what still needs a human.

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

Applied to the login screen and dashboard shell added in PL-4 (as Tailwind v4 `@theme` tokens in
`frontend/src/app/globals.css`: `bg-brand-purple`, `text-brand-navy`, etc.). The Mutual NDA
builder itself is deliberately untouched — PL-4 is scaffolding around the existing feature, not a
product change — so it still uses the neutral stone palette.

## Implementation Status

### Completed (PL-2)
- 12 CommonPaper agreement templates in templates/, CC BY 4.0
- catalog.json indexing each template with name, description, filename and source

### Completed (PL-3)
- Next.js 16 app in frontend/, statically prerendered
- Mutual NDA creator: form for the Cover Page fields, live preview, Markdown download,
  print-to-PDF via the browser dialog
- Standard Terms read verbatim from templates/mutual-nda.md at build time
- 39 unit and component tests (Vitest), 6 end-to-end tests (Playwright)

### Completed (PL-4)
- `backend/`: uv/FastAPI project with a SQLite `users` table, recreated from scratch on every
  startup — no migrations, because there is nothing to migrate yet
- Fake login screen: realistic sign in/sign up form (any email accepted, no password check),
  backed by a real `POST /api/auth/login` upsert so the full stack (frontend → API → SQLite) is
  exercised end to end
- New dashboard listing all 12 documents from catalog.json; only the Mutual NDA links out, the
  other 11 show as "Coming soon"
- Client-side session gate (`localStorage`, no server at request time since the frontend is a
  static export) in front of the dashboard and the Mutual NDA builder
- Single Docker image (multi-stage: Next static export, then FastAPI serving it) and the six
  `scripts/start-*`/`stop-*` files
- 15 new frontend unit/component tests (Vitest) and 3 new end-to-end tests (Playwright), plus
  8 backend tests (pytest)

### Outstanding
- PL-1: marketing site describing the company — still To Do
- No real authentication, persistence beyond the `users` row, or AI chat yet

### Current API Endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/auth/login` | Upserts a user by email (fake login, no password check) and returns their id |
