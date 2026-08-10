# Prelegal web app

A prototype for drafting agreements from the templates curated in [`../templates`](../templates).

Every document in [`../catalog.json`](../catalog.json) (PL-4) is reached from the dashboard and has
a working builder (PL-6): the **Mutual NDA creator** (PL-3) keeps its own dedicated route and
hand-typed fields, and the other eleven use one generic builder driven by
[`../document-fields`](../document-fields) — one JSON config per document (field names, labels,
types) plus its curated template. Either way, fields can be filled in by chatting with an AI
assistant or by editing the form directly (PL-5); both stay in sync with the same live preview,
download and print output. The dashboard also has a "not sure which document you need?" chat
(PL-6) that maps a free-form description to the closest catalog document. A fake login screen
(PL-4) sits in front of all of it: any email is accepted and there is still no password check, but
as of PL-7 signup and sign-in are distinct (an email can't sign up twice, or sign in before signing
up) and "signed in" still just means a session sits in the browser's `localStorage`. As of PL-7,
every builder also autosaves its in-progress document to that user's history as they edit; the
dashboard lists it under "Your documents" and opening one shows a read-only view. See the root
[`../CLAUDE.md`](../CLAUDE.md) for the real backend and Docker setup this now runs behind.

## Getting started

This app is statically exported (`output: "export"` in `next.config.ts`) and served by the
FastAPI backend in [`../backend`](../backend) — see the root README/CLAUDE.md and
`../scripts/start-*` for running the whole stack in Docker at <http://localhost:8000>.

For frontend-only iteration:

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The login screen and any of the chats won't be able to reach the
backend this way (`/api/auth/login`, `/api/mnda/chat`, `/api/documents/[slug]/chat` and
`/api/documents/route` are all same-origin requests, and there's no backend on port 3000) — run the
full stack via Docker to exercise any of them end to end.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests in a real browser (Playwright) |
| `npm run lint` | ESLint |

See [TESTING.md](TESTING.md) for what is covered and what still needs a human.

## Routes and the login gate

There is no server at request time (this is a static export), so `/login`, `/dashboard`, `/nda`,
every `/documents/[slug]` and `/documents/view` are gated on the client: `RequireSession` checks
`localStorage` for a session on mount and redirects to `/login` if there isn't one. `/` itself is
just a redirect gate to whichever of those applies. Signing in calls the real backend
(`POST /api/auth/login`, or `POST /api/auth/signup` from the form's sign-up mode) — still no
password check, but as of PL-7 the two are no longer the same operation: signing in fails for an
email with no account, signing up fails for one that already has one.

## How it works

### The generic builder (every document except the Mutual NDA)

None of the other eleven templates ship with their own blank Cover Page the way the Mutual NDA
does — they are pure Standard Terms, prose that only cross-references deal-specific values by name
(`coverpage_link`, `orderform_link`, `keyterms_link`, `businessterms_link`, `sow_link` spans). Each
`document-fields/<slug>.json` config lists that document's fields (name, label, type, and the two
parties' labels — "Provider"/"Customer", "Company"/"Partner", and so on, since they vary per
document); `lib/documents/render.ts` generates a Cover Page from it, the same way it's generated
for the Mutual NDA, and appends the Standard Terms verbatim below with its cross-references
resolved to bold defined-term references. Unlike `templates/mutual-nda.md`, none of these ten
templates carry an inline CC BY 4.0 notice of their own (only `templates/LICENSE.txt` does, at the
directory level) — `ensureAttribution` appends one, since it's a licence condition, not decoration.

### The Mutual NDA (special-cased)

The Common Paper Mutual NDA has two parts, and this app treats them differently:

- **Standard Terms** — fixed boilerplate. Read verbatim from `../templates/mutual-nda.md`, so
  the repository's `templates/` directory stays the single source of truth. The page is
  statically prerendered, so this read happens at build time and the text is inlined into the
  output; there is no filesystem dependency at runtime.
- **Cover Page** — the deal-specific terms. Generated from the form data rather than
  string-patched into the template, whose cover page is a blank form of checkboxes and
  bracketed prompts. That form data can come from typing into `NdaForm` directly, or from chatting
  with `NdaChat`: a message goes to `POST /api/mnda/chat` along with the current field values, and
  the reply comes back with only the fields that turn actually changed, applied as a patch — so an
  in-flight chat reply can never clobber an edit made to the form in the meantime.

The Standard Terms cross-reference the Cover Page through
`<span class="coverpage_link">…</span>` markers. `resolveCrossReferences` renders these as their
defined terms and substitutes no user values, matching
[the published text](https://commonpaper.com/standards/mutual-nda/1.0) — the Cover Page declares
the Standard Terms "identical to those posted", and every deal-specific value belongs on the
Cover Page anyway.

Everything the user types is escaped before it reaches the document, so a `#` typed into Purpose
cannot become a heading and a company name ending in `**` cannot leave an emphasis span open
across the clauses that follow.

`renderMnda` is a pure function, so the live preview, the Markdown download and the print view
cannot drift apart. It is where the tests are concentrated.

```
src/
  app/
    page.tsx                 client redirect gate: /login or /dashboard
    login/page.tsx            the fake login form
    dashboard/page.tsx        server component; loads catalog.json
    nda/page.tsx               server component; loads the Standard Terms
    documents/[slug]/page.tsx  server component; generateStaticParams over document-fields
    documents/view/page.tsx    static; reads ?id= client-side (a saved document's id is minted at
                                runtime, so there's nothing to generateStaticParams over) (PL-7)
  components/
    require-session.tsx      client-side route guard
    app-shell.tsx             shared chrome: logo, sign out, draft-disclaimer banner (PL-7)
    login-form.tsx           login/sign-up form, posts to /api/auth/login or /api/auth/signup
    dashboard.tsx             catalog grid; every card links out except the NDA Standard Terms
    document-history-list.tsx "Your documents" section on the dashboard (PL-7)
    saved-document-view.tsx   read-only view of one saved document (PL-7)
    routing-chat.tsx          "not sure which document?" chat; posts to /api/documents/route
    nda-builder.tsx           form state, autosave, downloads, layout (Mutual NDA)
    nda-form.tsx              the Cover Page fields (Mutual NDA)
    nda-chat.tsx              chat panel; posts to /api/mnda/chat
    nda-preview.tsx           Markdown → HTML, reused by the generic builder and the read-only view
    document-builder.tsx      form state, autosave, downloads, layout (every other document)
    document-form.tsx         fields rendered from a DocumentConfig
    document-chat.tsx         chat panel; posts to /api/documents/[slug]/chat
  lib/
    catalog.ts                server-only read of ../catalog.json
    party.ts                  the shared Party shape (company/signatory/notice address)
    document-links.ts         catalog entry -> builder route, or null if not a starting point
    routing.ts                routing chat fetch call
    auth/session.ts           localStorage session read/write/clear
    disclaimer.ts              the draft notice baked into every rendered document (PL-7)
    autosave.ts                useAutosave, generic over either builder's form data (PL-7)
    saved-documents.ts         fetch calls to /api/saved-documents (PL-7)
    mnda/
      fields.ts               field types, defaults, completeness check
      template.ts             server-only read of ../templates
      render.ts               pure Markdown renderer
      chat.ts                 chat fetch call + reply-vs-sent field diffing
    documents/
      registry.ts              server-only read of ../document-fields
      fields.ts                generic field values, defaults, completeness check
      template.ts               server-only read of ../templates, by filename
      render.ts                 pure Markdown renderer, generic across every DocumentConfig
      chat.ts                   chat fetch call + reply-vs-sent field diffing
```

## Downloads

- **Download Markdown** — builds the file in the browser and saves it. No server round trip.
- **Print / Save as PDF** — the browser's own print dialog, with print styles that drop the app
  chrome and lay the agreement out on white paper.

Unfilled fields never block either one; they appear as `[Bracketed Placeholders]`, matching how
the source template marks blanks.

## Deploying

The build reads `../templates`, `../catalog.json` and `../document-fields`, which sit outside this
directory. Any build context that contains only `frontend/` — a Vercel project with the Root
Directory set to `frontend` and "include files outside the root directory" left off, or a
Dockerfile that copies just this folder — will fail at `next build` with `ENOENT`. It fails loudly
rather than shipping a broken document, but the deployment setup has to include the repository
root. The root `Dockerfile` does this: it builds this app in a Node stage with the full repo as
context, then serves the exported `out/` from the FastAPI backend. The backend needs the same two
non-`templates` directories at runtime too (`document-fields` for the per-document chat schemas,
`catalog.json` for the routing chat) — see `PRELEGAL_DOCUMENT_FIELDS_DIR`/`PRELEGAL_CATALOG_PATH`
in the root `Dockerfile` and `../CLAUDE.md`.

## Scope

Every document in `catalog.json` has a working builder as of PL-6, except its Mutual NDA Standard
Terms entry — boilerplate incorporated by reference into the Cover Page, not something a user
starts on its own, so the dashboard never links to it. Login is still fake (any email, no password
check) and the "session" is still just `localStorage` — there is no real authentication. As of
PL-7, signup and sign-in are at least distinct operations, and a document a user drafts now
autosaves and survives a page reload (until the next server restart, which wipes the database as
designed) as read-only history — the conversation that produced it does not.

## Licensing

Documents are based on the Common Paper templates in [`../templates`](../templates), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see `../templates/LICENSE.txt`). The
attribution notice is part of every rendered document and must stay in any output.

Documents produced here are not legal advice.
