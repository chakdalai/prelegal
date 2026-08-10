# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

As of PL-6, every document in the catalog has a working builder. Its fields can be filled in either
by chatting with an AI assistant or by editing the manual form directly — both stay in sync with
the same live preview, Markdown download and print view. If a user isn't sure which document they
need, a chat on the dashboard maps a free-form description to the closest catalog document (or
explains that nothing fits well and asks a follow-up question) rather than requiring them to
already know Prelegal's document names.

As of PL-7, signup and sign-in are distinct (an email can't sign up twice, or sign in before
signing up), every builder autosaves its in-progress document to the signed-in user's history as
they edit, the dashboard surfaces that history as a read-only list, and every generated document
carries a "this is a draft, not legal advice" notice both in the app and baked into the document
itself. See the Technical design section below for how each of these was built.

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

Built (PL-6): two more chat features — one per-document chat covering the ten other catalog
documents that get their own builder (`POST /api/documents/{slug}/chat` — the Mutual NDA Standard
Terms entry is the eleventh non-Cover-Page catalog entry, but it never gets one; see below), and
the dashboard's routing chat (`POST
/api/documents/route`). Both share `backend/app/llm_common.py`'s retry policy and error type with
`llm.py`, but `llm.py` itself is left untouched rather than refactored onto it — it's the one
chat feature already verified against the real API with its own retry tests, and the shared module
exists only to avoid duplicating that logic between the two *new* call sites
(`backend/app/document_llm.py`, `backend/app/routing_llm.py`). `llm_common.complete_with_retry`
validates the Structured Outputs response *inside* its own try/except, same as `llm.py`'s
`generate_turn` does inline — a malformed response is exactly as much "the LLM call failed" as a
network error, and both must collapse to the same `LlmUnavailableError` rather than an uncaught
`pydantic.ValidationError` reaching the client as a 500. (An earlier version of this code did leave
that validation outside the guarded block; caught by `test_document_chat.py`'s "response does not
validate" test before it shipped.)

Structured Outputs schemas for the ten generic documents are *dynamic*, not hand-typed like
`mnda_schema.py`: `backend/app/document_fields.py` builds a Pydantic model per document at runtime
(`pydantic.create_model`) from that document's `document-fields/<slug>.json` config, cached per
slug. Every field is a plain `str`/`Optional[str]` — no per-document unions like `MndaTerm` — so
there is no `discriminator`/`oneOf` risk to begin with; `test_document_fields.py` asserts this
directly on the generated JSON schema rather than relying on it never coming up.

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
provides. The same limitation now applies to `POST /api/mnda/chat` (PL-5) and, as of PL-6, `POST
/api/documents/{slug}/chat` and `POST /api/documents/route` — test any of them via Docker, or mock
the endpoint (`page.route` in Playwright, `vi.stubGlobal("fetch", ...)` in Vitest).

The backend reads two more repo-root files at runtime as of PL-6 (`document-fields/` for the
generic chat schemas, `catalog.json` for the routing chat) — files the frontend previously only
read at *build* time. `backend/app/config.py`'s `.env` lookup already resolves relative to the
source tree's `backend/app/` depth (`parents[2]`), which happens to reach the repo root in local
dev but not in the Docker image (only `backend/app`'s *contents* are copied to `/app/app`, not the
rest of the repo's layout) — harmless there since a missing `.env` is a deliberate no-op. The new
reads can't tolerate that same mismatch, so `document_fields.py`/`routing_llm.py` add
`PRELEGAL_DOCUMENT_FIELDS_DIR`/`PRELEGAL_CATALOG_PATH` overrides, set in the Dockerfile next to the
existing `PRELEGAL_STATIC_DIR`/`PRELEGAL_DB_PATH`. Caught by an actual `docker build` failing with
`ENOENT` before this was added — the local test suite alone wouldn't have surfaced it, since
`uv run pytest` from `backend/` never exercises the Docker path depth.

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
- Was scoped to the Mutual NDA only, per PL-5's own title, deliberately deferring generalization to
  the other 11 catalog documents until a second document actually needed it. PL-6 is that need —
  see the section below for how the seam was built, and why the Mutual NDA itself stayed exactly
  as this section describes rather than being folded into the generic shape.
- **Always ask a follow-up question while fields are still missing.** Added in PL-6: the original
  prompt would sometimes just acknowledge a value and stop, leaving the user unsure whether to keep
  talking or switch to the form. Every system prompt (`llm.py`, `document_llm.py`, `routing_llm.py`)
  now explicitly instructs `reply` to end with a specific follow-up question whenever something
  needed is still outstanding, and to say so plainly instead only once nothing is. Tested for
  presence in the prompt text (`test_system_prompt_always_asks_a_follow_up_question_*`), not for
  the model actually complying every turn — that part isn't something a test can guarantee, only a
  real conversation can (see `frontend/TESTING.md`'s AI chat checklist).
- **Focus returns to the message input after a turn finishes.** Also PL-6: previously, sending a
  message left focus wherever the click/Enter landed, so a keyboard-only or fast-typing user had to
  reach for the input again after every reply. `NdaChat`/`DocumentChat`/`RoutingChat` all track
  whether a turn has ever been sent (a mount-time autofocus would be a worse surprise than the
  original problem) and refocus the input once `sending` goes back to `false` — on both a
  successful reply and a failed one, so a failed turn is just as easy to retry.

### Generic document builder design (PL-6)

- **Only the Mutual NDA has a curated Cover Page in `templates/`.** The other ten catalog documents
  (every catalog entry except the Mutual NDA's Cover Page and Standard Terms, which together are
  one product) are pure Standard Terms — prose that cross-references deal-specific values by name
  via `coverpage_link`/`orderform_link`/`keyterms_link`/`businessterms_link`/`sow_link` spans,
  exactly like the Mutual NDA's own Standard Terms — with no separate blank cover page shipped
  alongside them in this repo. There was nothing to mail-merge values into; a Cover Page had to be
  *generated* for these ten the same way the Mutual NDA's already is, driven by a per-document field list
  instead of a curated template.
- **One JSON config per document, not one hand-typed TS/Pydantic pair per document like the Mutual
  NDA's.** `document-fields/<slug>.json` (name/label/type per field, plus the two parties' own
  labels — "Provider"/"Customer", "Company"/"Partner", etc., since they differ per document) is the
  single source of truth, read by both `frontend/src/lib/documents/registry.ts` (build time) and
  `backend/app/document_fields.py` (runtime, building a Pydantic model per slug via
  `pydantic.create_model`). Every field is `text`/`textarea`/`date` — no per-document unions like
  `MndaTerm` — traded deliberately for being able to actually cover all ten documents in one
  pass; a real upgrade path if a document later needs a Mutual-NDA-grade election field.
- **The five span classes all resolve to bold defined-term references, never a substituted value**
  — `resolveCrossReferences` in `frontend/src/lib/documents/render.ts` generalizes
  `lib/mnda/render.ts`'s version to all five, for the identical reason documented there. Watch the
  regex if editing it: a span can carry an `id` attribute alongside `class` (e.g. `<span
  class="coverpage_link" id="4.5.a">`), in either order — `<span class="X">` alone misses these and
  leaves visibly unresolved cross-references (caught by `render.test.ts` against several of the real
  templates, not just a synthetic example, before it shipped). Bare `<span id="...">` anchors with
  no link class are left alone; they're internal section anchors, not cross-references, and
  react-markdown renders no raw HTML regardless.
- **These ten templates need an appended CC BY 4.0 attribution; the Mutual NDA's already carries one
  inline.** Only `templates/mutual-nda.md`/`mutual-nda-coverpage.md` end with their own attribution
  line — the other ten rely solely on the directory-level `templates/LICENSE.txt`, which this app
  never surfaces to a user. `ensureAttribution` appends a notice whenever the template text doesn't
  already carry one, since (per the rule below) attribution is a licence condition, not decoration.
- **The Mutual NDA was left exactly as PL-3/PL-5 built it, not migrated onto this generic shape.**
  `lib/mnda/fields.ts`/`render.ts`, `NdaForm`/`NdaChat`/`NdaBuilder`, and `backend/app/mnda_schema.py`
  are untouched — same route (`/nda/`), same richer election-field UX (`MndaTerm`,
  `ConfidentialityTerm`). The generic pieces (`lib/documents/*`, `Document*` components,
  `document_fields.py`, `/documents/[slug]/`) exist alongside them for the other ten documents.
  `frontend/src/lib/party.ts` is the one piece of overlap deliberately pulled out shared — the
  `Party` shape (company/signatory/notice address) is identical in both and small enough that
  sharing it doesn't cost the risk of touching either's tested rendering logic.
- **The dashboard's routing chat (`POST /api/documents/route`) is a separate feature from any one
  document's fill-in chat**, per PL-6's own "engage with the user if they want an unsupported
  document ... offer the closest document" requirement — it needs to see the whole catalog, not one
  document's fields. `routing_llm.py` builds its system prompt from `catalog.json` directly (minus
  the Mutual NDA Standard Terms entry, which is never a starting point — see
  `hrefForCatalogEntry`), and always tries to name the *closest* catalog document once the user has
  said enough, even an imperfect fit, rather than only ever exact-matching.

### Multi-user & document history design (PL-7)

- **Signup and sign-in are now distinct operations, but auth stays passwordless.** The single
  `POST /api/auth/login` that used to upsert unconditionally (`backend/app/routers/auth.py`) is now
  two routes: `POST /api/auth/signup` (`201`, `409` if the email already has an account) and
  `POST /api/auth/login` (`200`, `404` if it doesn't). There is still no password column and no
  password check anywhere — `LoginForm`'s previous password `<input>` was collected and silently
  discarded, which read as a security property the app didn't have, so it was removed rather than
  wired up. With no password to distinguish "wrong credentials" from "wrong mode", the 404/409
  response is the only signal telling the user which mode (`sign-in`/`sign-up`) they should be in,
  so `LoginForm` surfaces it as an explicit "try signing up/in instead" message rather than a
  generic error.
- **Documents autosave; there is no explicit Save button.** `frontend/src/lib/autosave.ts`'s
  `useAutosave` hook is generic over the caller's own form-data shape (`T`) — it never imports
  `MndaFormData` or `DocumentFormData`, only `JSON.stringify`s whatever `data` it's given — so
  `NdaBuilder` and `DocumentBuilder` both call the same hook with their own state without either
  needing to know about the other, the same reasoning `frontend/src/lib/party.ts` was pulled out
  shared for. Nothing saves until the form first differs from its mount-time default (so merely
  opening a builder page never creates an empty history row), and writes are debounced (~1.5s)
  rather than firing per keystroke. The document id is minted client-side
  (`crypto.randomUUID()`) once, on the first real save, and reused for every save after that,
  making every write the same idempotent upsert (`PUT /api/saved-documents/{id}`,
  `INSERT ... ON CONFLICT(id) DO UPDATE` in `backend/app/routers/documents.py`) rather than a
  create/update branch the frontend has to manage.
- **A new `documents` table, deliberately schema-agnostic.** `backend/app/db.py`'s `SCHEMA_SQL`
  gained a `documents` table (`user_id`, `slug`, `title`, `form_data` JSON blob, `markdown`
  snapshot, `created_at`/`updated_at`) — since `init_db` now runs more than one `CREATE TABLE`
  statement, it switched from `conn.execute` to `conn.executescript`. The backend never parses
  `form_data`; it round-trips whatever JSON the frontend sends. This is unlike
  `document_fields.py`'s per-slug dynamic Pydantic models (built for validating LLM Structured
  Outputs) — persistence has no equivalent validation need, since saved documents are read-only
  history (see below), never reconstructed into a builder. Every route — the two reads
  (`GET /api/saved-documents`, `GET /api/saved-documents/{id}`) and the upsert write
  (`PUT /api/saved-documents/{id}`) — is scoped to the requesting `userId`: a write whose id
  already belongs to a different user's row 404s exactly like a read would, rather than silently
  overwriting it. `userId` itself is still client-trusted (`session.id` is read from
  `localStorage` and sent verbatim everywhere else too, matching the app's existing identity
  model) — what this scoping actually prevents is one *document id* colliding across users, not a
  user lying about who they are.
- **Saved documents are read-only, not resumable drafts.** Opening a history entry
  (`/documents/view/?id=...`, `SavedDocumentView`) fetches the stored `markdown` snapshot and
  renders it through the existing shared `NdaPreview` — the same component both builders already
  use for their live preview — with Print/Download available but no form, no chat, and no
  `onChange` path anywhere in the component, so it cannot become an edit surface by accident. Since
  `output: "export"` needs every dynamic route's params known at build time and a saved document's
  id is minted at runtime in the browser, this is a single static page reading `?id=` client-side
  (wrapped in `Suspense`, as `useSearchParams` requires) rather than a `/documents/[id]/` dynamic
  segment. The dashboard's "Your documents" section (`DocumentHistoryList`) lists every saved
  document for the signed-in user, most recently updated first, each linking here.
- **`AppShell` is chrome-only, not a per-page header replacement.** A slim top bar (logo back to
  `/dashboard/`, signed-in email, sign out) plus the draft-disclaimer banner, wrapped around every
  authenticated page's content at the `page.tsx` level (`RequireSession > AppShell > page content`)
  rather than inside `Dashboard`/`NdaBuilder`/`DocumentBuilder` themselves. Each page keeps its own
  page-specific header below it (title, Print/Download actions) — `AppShell` only owns global
  navigation and the disclaimer, so wrapping a page in it never requires restructuring that page's
  existing header into props. This is also why the `.legal-doc` typography in `globals.css` (the
  rendered agreement itself) is untouched: `AppShell` never touches document content, only app
  chrome, so the deliberately-neutral Mutual NDA and generic builder pages (see PL-4's Color Scheme
  note) now have a branded top bar around an otherwise-unchanged neutral builder.
- **The draft disclaimer exists in two places for two different purposes**, both new in PL-7:
  `AppShell`'s banner is in-app-only (`no-print`) chrome, visible while drafting; `ensureDraftDisclaimer`
  (`frontend/src/lib/disclaimer.ts`) is baked into the generated Markdown itself, prepended by both
  `renderMnda` and `renderDocument`, so it survives download and print — modeled directly on
  `ensureAttribution`'s pure, idempotent, gate-on-"already contains this" shape. The two builders'
  own `no-print` footers had their now-redundant "not legal advice" sentence trimmed (the CC BY 4.0
  attribution link stays) since the banner covers the same ground more prominently.
- **`documentTitle` distinguishes multiple drafts of the same document type.** Both `render.ts`
  modules gained a `documentTitle(data)`/`documentTitle(config, data)` helper (party company names,
  falling back to the plain document title before they're known) so a user's history list doesn't
  show several indistinguishable "Mutual NDA" entries differing only by timestamp.

### Agreement rendering rules

- **Standard Terms render verbatim, for every document.** `templates/mutual-nda.md` (and, as of
  PL-6, the ten other templates in `templates/` that aren't the Mutual NDA's own two) is
  incorporated into the agreement by reference, and the Mutual NDA's Cover Page declares it
  "identical to those posted at commonpaper.com/standards/mutual-nda/1.0" — the same principle
  holds for the other ten even without an equivalent sentence spelling it out. Never substitute a
  user's values into it: the
  published text carries `coverpage_link`/`orderform_link`/`keyterms_link`/`businessterms_link`/
  `sow_link` cross-references as defined terms, not blanks. Substituting also breaks §9's second
  sentence of the Mutual NDA specifically, which becomes "the conflict of laws provisions of such
  Delaware". Deal-specific values belong on the Cover Page — generated, for the ten documents
  that don't ship with their own (see PL-6's design notes above).
- **The CC BY 4.0 attribution must survive into every generated document.** It is a licence
  condition, not decoration. Verify this holds for a newly-added document specifically: only the
  Mutual NDA's own templates carry the notice inline; every other template needs
  `ensureAttribution` to actually append one, and a template gaining its own inline notice later
  would need that appended copy suppressed instead of duplicated.
- **The draft disclaimer must survive into every generated document, as of PL-7.** `renderMnda` and
  `renderDocument` both prepend it via `ensureDraftDisclaimer` (`lib/disclaimer.ts`) — see PL-7's
  design notes above. Verify it for a newly-added document the same way as the CC BY notice.
- **Escape everything the user types** before it reaches the document. A `#` in a free-text field
  becomes a heading; a company name ending in `**` opens an emphasis span that runs on through the
  clauses that follow.
- `templates/` is the single source of truth for agreement text. Read from it rather than copying
  it into an app.
- `renderMnda` (Mutual NDA) and `renderDocument` (every other document) are pure and feed the
  preview, the Markdown download and the print view. Keep them that way so the three cannot drift
  apart, and put new tests there first.

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
`frontend/src/app/globals.css`: `bg-brand-purple`, `text-brand-navy`, etc.). The Mutual NDA and
generic document builders' own content (the form, the rendered agreement) is deliberately
untouched — still the neutral stone palette — but as of PL-7 every authenticated page, including
both builders, sits inside the shared `AppShell` top bar, which does use the brand tokens. See
PL-7's design notes above for why chrome and document content were kept on separate palettes
rather than branding the builders wholesale.

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

### Completed (PL-6)
- Every catalog document now has a working builder — the ten that had none before (Mutual NDA
  already had its own since PL-3/PL-5): a Cover Page generated from a per-document
  `document-fields/<slug>.json` config (`frontend/src/lib/documents/`, `backend/app/document_fields.py`
  building a dynamic Pydantic model per slug), the Standard Terms appended verbatim from
  `templates/` with cross-references resolved and the required CC BY 4.0 attribution appended (see
  the design notes above), plus a chat (`POST /api/documents/{slug}/chat`,
  `backend/app/document_llm.py`) and manual form (`DocumentForm`) staying in sync exactly like the
  Mutual NDA's — reached at `/documents/[slug]/` (`generateStaticParams` over every config)
- A dashboard chat (`POST /api/documents/route`, `backend/app/routing_llm.py`, `RoutingChat`) maps
  a free-form description of a user's deal to the closest catalog document, or asks a follow-up
  question if it doesn't have enough to go on yet — the "engage with the user if they want an
  unsupported document ... offer the closest document" half of PL-6
- Every dashboard card now links to a builder except the Mutual NDA Standard Terms (relabeled
  "Included by reference", since "Coming soon" was no longer accurate for it either)
- Two cross-cutting chat fixes, applied to all three chat features (Mutual NDA, generic document,
  routing): the assistant's system prompt now always asks a follow-up question while fields are
  still missing rather than sometimes just acknowledging and stopping, and focus returns to the
  message input after every turn (success or failure) instead of being left wherever the click
  landed
- `backend/app/llm_common.py`: the retry policy and error type shared by the two new chat features,
  factored out without touching `llm.py` itself (already verified against the real API with its
  own tests) — see the AI design section above for why, including a real bug this caught before
  shipping (a malformed Structured Outputs response reaching the client as an uncaught 500 instead
  of the intended 502)
- `frontend/src/lib/party.ts`: the `Party` shape shared between the Mutual NDA and the generic
  builder, pulled out of `lib/mnda/fields.ts` (which now re-exports it for compatibility)
- Docker packaging updated for the backend's two new runtime file reads (`document-fields/`,
  `catalog.json`) — see the Technical design section above for `PRELEGAL_DOCUMENT_FIELDS_DIR`/
  `PRELEGAL_CATALOG_PATH`; caught by an actual `docker build` failing before this was added
- 77 new frontend unit/component tests (142 total; parameterized rendering/escaping/attribution
  coverage across all ten new documents' real templates, the generic form/chat/builder components,
  the routing chat, and the focus-return regression), 51 new backend tests (71 total; dynamic-model
  round-tripping for every document config, the generic and routing chat endpoints, the shared
  retry/validation module), and 5 new end-to-end tests (15 total: one representative generic
  document end to end, and the routing chat suggesting a document and asking a follow-up)
- Verified with a real `docker build` + `docker run --env-file .env`, including live chat turns
  against the real Cerebras API for both the new generic document chat and the routing chat (not
  just the mocked test suite) — one routing-chat turn asked for a residential lease (genuinely
  outside the catalog) and correctly asked a follow-up rather than forcing a bad suggestion

### Completed (PL-7)
- Signup and sign-in split into two endpoints with real (if still passwordless) semantics —
  `POST /api/auth/signup` (409 if the email already has an account) and `POST /api/auth/login`
  (404 if it doesn't) — replacing the old single upsert-on-any-email login. `LoginForm`'s
  decorative, never-sent password field was removed; a mode-aware 404/409 message offers to switch
  between sign-in and sign-up instead
- Every builder (Mutual NDA and the ten generic documents) now autosaves its in-progress document
  to the signed-in user's history as they edit, debounced and skipped while the form is still
  blank (`frontend/src/lib/autosave.ts`'s `useAutosave`, `PUT /api/saved-documents/{id}`,
  `backend/app/routers/documents.py`), backed by a new `documents` table in `backend/app/db.py` —
  see the design notes above for why the id is minted client-side and the table stores an opaque
  JSON blob rather than a typed shape
- A "Your documents" section on the dashboard (`DocumentHistoryList`) lists every autosaved
  document for the signed-in user, most recently updated first; opening one
  (`/documents/view/?id=...`, `SavedDocumentView`) shows a read-only rendering of the saved
  Markdown snapshot — no form, no chat, not resumable — reusing the same `NdaPreview` component
  both builders already use for their live preview
- A shared `AppShell` (logo, signed-in email, sign out, draft-disclaimer banner) now wraps every
  authenticated page, including both builders, which previously each hand-rolled their own header
  with no way back to the dashboard or to sign out — see the design notes above for why this is
  chrome-only and doesn't touch either builder's own page-specific header or the neutral
  `.legal-doc` document typography
- Every generated document now carries a "this is a draft, not legal advice" notice in two places:
  an in-app `no-print` banner (`AppShell`) and a notice baked into the Markdown itself
  (`ensureDraftDisclaimer`, `frontend/src/lib/disclaimer.ts`, prepended by both `renderMnda` and
  `renderDocument`) so it survives download and print — modeled on `ensureAttribution`. The two
  builders' own footers had their now-redundant "not legal advice" sentence trimmed
- `documentTitle` (`lib/mnda/render.ts`, `lib/documents/render.ts`) names a saved document's
  history entry after its parties, so multiple drafts of the same document type aren't
  indistinguishable in the list except by timestamp
- 36 new frontend unit/component tests (178 total; the autosave hook's debounce/blank-detection
  behavior under fake timers, the saved-documents service boundary (including the shared
  UTC-aware timestamp formatter both the history list and the read-only view use), `AppShell`, the
  dashboard history list, the read-only document view, the disclaimer module, and the reworked
  login form), 12 new backend tests (83 total; the signup/login split, the new documents endpoints,
  a cross-user ownership-isolation test on both the write and the read paths), and 3 new end-to-end
  tests (18 total: the full
  autosave-to-dashboard-history-to-read-only-view flow, and the signup/login failure paths offering
  to switch modes)
- Verified with a real `docker build` + `docker run`, including a full signup → duplicate-signup
  (409) → unknown-email login (404) → autosave a document → list it → fetch it scoped to the
  correct owner (404 for a different `userId`) → container restart confirming the DB (documents
  included) resets from scratch, matching the "temporary" requirement

### Outstanding
- PL-1: marketing site describing the company — still To Do
- Auth remains passwordless and the "session" is still an unsigned `localStorage` blob — real
  authentication (a password, a real token) is still not built
- No chat history persists anywhere — a chat transcript is lost on reload for every document,
  matching the stateless design chosen for the Mutual NDA in PL-5. Only the *document* (fields +
  rendered Markdown) now survives, via PL-7's autosave — the conversation that produced it does not
- A saved document is read-only history, not a resumable draft — reopening one shows the snapshot
  but does not reload it back into the builder for further editing (a deliberate PL-7 scope cut;
  `formData` is already stored, so this is a small addition if it's ever wanted)

### Current API Endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/auth/signup` | Registers a new user by email (fake — still no password check); 409 if the email already has an account |
| `POST` | `/api/auth/login` | Signs in an existing user by email; 404 if no account exists for it |
| `POST` | `/api/mnda/chat` | One stateless Mutual NDA chat turn: takes the transcript + current fields, returns a reply + the fields with the LLM's patch merged in |
| `POST` | `/api/documents/{slug}/chat` | As above, generalized to the ten other catalog documents that have a builder (not the Mutual NDA Standard Terms); 404 if `slug` has no `document-fields/*.json` config |
| `POST` | `/api/documents/route` | One stateless routing-chat turn: takes the transcript, returns a reply + the closest catalog filename (or `null` if not enough is known yet) |
| `PUT` | `/api/saved-documents/{id}` | Autosave upsert: creates or updates a saved document by client-generated id |
| `GET` | `/api/saved-documents` | Lists a user's saved documents (`?userId=`), most recently updated first |
| `GET` | `/api/saved-documents/{id}` | Fetches one saved document's full detail (`?userId=`); 404 if missing or not owned by that user |
