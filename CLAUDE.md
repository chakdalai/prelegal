# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation covers the Mutual NDA only. As of PL-5, the Cover Page can be filled in
either by chatting with an AI assistant or by editing the manual form directly — both stay in sync
with the same live preview, Markdown download and print view.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

Merges to `main` are squash merges, so each PR becomes one commit titled `... (#N)`.

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

The OPENROUTER_API_KEY belongs in a `.env` file in the project root. `backend/app/config.py` loads
it via `load_dotenv()`; `scripts/start-*` pass it into the Docker container with `--env-file .env`
(guarded so a missing `.env` doesn't stop the rest of the app from working — only chat degrades).

Built (PL-5): `backend/app/llm.py` is the first code that actually calls an LLM, for the Mutual
NDA chat endpoint (`POST /api/mnda/chat`, `backend/app/routers/mnda_chat.py`).

**Cerebras via OpenRouter rejects `discriminator`/`oneOf` in Structured Outputs.** The skill's own
example doesn't hit this, but a Pydantic discriminated union (`Annotated[Union[...],
Field(discriminator=...)]`) generates a `oneOf` JSON schema, and Cerebras's structured-output
support returns `400 Unsupported JSON schema fields ... discriminator, oneOf` for it. Model a
"kind"-tagged shape as one flat model with optional fields instead (see `MndaTerm`/
`ConfidentialityTerm` in `backend/app/mnda_schema.py`) — a `Literal` enum field is fine, only the
`Union`/`discriminator` combination is rejected. Verified against the real API, not just inferred
from the error message.

**The shared free-tier `OPENROUTER_API_KEY` gets rate-limited under repeated requests.** Live
testing hit a real `429` from OpenRouter's shared pool for `gpt-oss-120b`
(`retry_after_seconds: 59`) more than once — not a code bug, but worth knowing before assuming
"temporarily unavailable" means something broke. `generate_turn` (`backend/app/llm.py`) retries
once, after a short fixed delay (`RETRY_DELAY_SECONDS`, not the provider's own — often much
longer — `Retry-After`), for genuinely transient error classes (`RateLimitError`,
`APIConnectionError`, `InternalServerError`, `ServiceUnavailableError`, `Timeout`); anything else
fails immediately, since retrying e.g. a bad API key or a malformed request wouldn't change the
outcome. It still logs the full exception (`logger.exception`) before the router collapses
whatever finally failed into the same generic 502, so check `docker logs` for the real cause
rather than guessing from the client-facing message.

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
provides. The same limitation now applies to `POST /api/mnda/chat` (PL-5) — test it via Docker, or
mock the endpoint (`page.route` in Playwright, `vi.stubGlobal("fetch", ...)` in Vitest).

### AI chat design (PL-5)

- **Stateless, no persistence.** Each turn the frontend sends the full conversation transcript
  plus the current `MndaFormData` snapshot; the backend calls the LLM and returns a reply plus the
  new full snapshot. No chat history is stored anywhere — a page reload starts over. This matches
  the rest of the app (SQLite holds only `users`, recreated from scratch every boot) and avoids
  needing real sessions, which don't exist yet either.
- **The backend merges its patch onto the request snapshot; the frontend re-diffs and patches the
  live state.** The LLM returns a *patch* (every field optional; `null` means "not addressed this
  turn") via Structured Outputs. `merge_patch` in `backend/app/mnda_schema.py` merges that patch
  onto the snapshot the frontend sent, and returns the full result. The frontend does not then
  apply that full result wholesale: an LLM round trip takes a few seconds, long enough for the user
  to have edited the form in the meantime, and a full replace would silently discard that edit.
  `fieldsPatchSince` (`frontend/src/lib/mnda/chat.ts`) diffs the response against the snapshot that
  was *sent*, recovering only the fields the turn actually changed, and applies that as a patch via
  the same functional-update path (`update`, in `NdaBuilder`) the manual form already uses — onto
  whatever the live state is by the time the reply arrives, not the stale snapshot from when the
  request was made. A turn that fails leaves the current fields, and the manual form, completely
  untouched.
- **Hybrid by design, not a stopgap.** The manual form (`NdaForm`) stays fully visible and
  editable next to the chat panel (`NdaChat`) — chat is the primary way to fill fields, the form is
  the correction/verification path. Do not remove either without deciding that trade-off again.
- **Chat only ever writes into `MndaFormData`, never into rendered Markdown.** `renderMnda`'s
  existing escaping already covers whatever lands in the fields regardless of whether the form or
  the chat put it there — do not add separate escaping/sanitization for chat-sourced values.
- Scoped to the Mutual NDA only, per PL-5's own title. Generalizing this to the other 11 catalog
  documents was deliberately deferred rather than abstracted for now — build that seam when a
  second document actually needs it.

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
  `scripts/start-*`/`stop-*` files — verified with a real `docker build` + `docker run`, including
  a container restart confirming the same email gets a new user id (the database really is
  recreated from scratch each time)
- The live Mutual NDA card on the dashboard has a persistent blue border and a "Start drafting"
  link, not just a hover effect — the first version only differed from the 11 "Coming soon" cards
  on hover, which read as if nothing were clickable
- 16 new frontend unit/component tests (Vitest, including a cross-tab sign-out regression test)
  and 3 new end-to-end tests (Playwright), plus 8 backend tests (pytest)

### Completed (PL-5)
- `POST /api/mnda/chat`: a stateless chat turn — takes the conversation transcript and current
  Cover Page fields, calls the LLM via `backend/app/llm.py` (Cerebras/OpenRouter, Structured
  Outputs), and returns a reply plus the fields with the LLM's patch merged in
  (`backend/app/mnda_schema.py::merge_patch`)
- `NdaChat` (`frontend/src/components/nda-chat.tsx`): a chat panel composed above the existing
  manual form in `NdaBuilder` — both edit the same `MndaFormData` state, so the live preview,
  download and print stay in sync regardless of which one the user used
- `.env` loading (`backend/app/config.py`) and Docker env passthrough (`--env-file .env`, guarded
  with a plain `if`/`else` — not an empty-array `"${arr[@]}"` expansion, which is an "unbound
  variable" error under `set -u` on bash < 4.4, notably macOS's `/usr/bin/bash` — in all three
  `scripts/start-*`) so `OPENROUTER_API_KEY` actually reaches the running container
- Discovered and worked around a real Cerebras/Structured-Outputs constraint: discriminated unions
  in the JSON schema are rejected — see the AI design section above
- `fieldsPatchSince` (`frontend/src/lib/mnda/chat.ts`): a chat reply is diffed against the snapshot
  that was sent, not applied wholesale, so a manual form edit made while a reply was in flight
  survives instead of being silently overwritten
- 9 new backend tests (pytest: patch-merge semantics, a successful turn, LLM-failure and
  malformed-output paths, each as an HTTP 502) and 10 new frontend tests (Vitest: the chat service
  boundary including `fieldsPatchSince`, and the chat panel), plus 1 new end-to-end test
  (Playwright, `POST /api/mnda/chat` stubbed) confirming a chat reply updates the form and the
  preview
- Verified with a real `docker build` + `docker run --env-file .env`, including one live chat turn
  against the real Cerebras API (not just the mocked test suite), and a follow-up live session that
  hit and diagnosed a real OpenRouter rate limit — see the AI design section above
- `backend/app/llm.py` logs the real exception (`logger.exception`) before it's collapsed into the
  fixed 502 the client sees, so failures are diagnosable from `docker logs` instead of invisible
- Follow-up: `generate_turn` retries once, after a short fixed delay, for transient LLM failures
  (rate limit, connection error, 5xx, timeout) — see the AI design section above. 3 more backend
  tests (retries-then-succeeds, gives-up-after-retry-also-fails, does-not-retry-a-non-retryable-
  error), for 20 backend tests total

### Outstanding
- PL-1: marketing site describing the company — still To Do
- No real authentication or persistence beyond the `users` row and the SQLite database itself
- AI chat covers the Mutual NDA only — the other 11 catalog documents still have no builder at all

### Current API Endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/auth/login` | Upserts a user by email (fake login, no password check) and returns their id |
| `POST` | `/api/mnda/chat` | One stateless Mutual NDA chat turn: takes the transcript + current fields, returns a reply + the fields with the LLM's patch merged in |
