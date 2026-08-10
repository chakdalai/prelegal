# Prelegal web app

A prototype for drafting agreements from the templates curated in [`../templates`](../templates).

Currently one document type is wired up: the **Mutual NDA creator** (PL-3), reached from a
dashboard listing all twelve documents in [`../catalog.json`](../catalog.json) (PL-4) — the other
eleven are shown as "Coming soon". Its Cover Page fields can be filled in by chatting with an AI
assistant or by editing the form directly (PL-5); both stay in sync with the same live preview,
download and print output. A fake login screen (PL-4) sits in front of it: any email is accepted,
there is no password check, and "signed in" just means a session sits in the browser's
`localStorage`. See the root [`../CLAUDE.md`](../CLAUDE.md) for the real backend and Docker setup
this now runs behind.

## Getting started

This app is statically exported (`output: "export"` in `next.config.ts`) and served by the
FastAPI backend in [`../backend`](../backend) — see the root README/CLAUDE.md and
`../scripts/start-*` for running the whole stack in Docker at <http://localhost:8000>.

For frontend-only iteration:

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The login screen and the Mutual NDA chat won't be able to reach
the backend this way (`/api/auth/login` and `/api/mnda/chat` are same-origin requests, and there's
no backend on port 3000) — run the full stack via Docker to exercise either end to end.

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

There is no server at request time (this is a static export), so `/login`, `/dashboard` and `/nda`
are gated on the client: `RequireSession` checks `localStorage` for a session on mount and
redirects to `/login` if there isn't one. `/` itself is just a redirect gate to whichever of those
applies. Signing in calls the real backend (`POST /api/auth/login`), which upserts a user by email
with no password check — the point is to exercise the real stack end to end, not to authenticate
anyone.

## How it works

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
  components/
    require-session.tsx      client-side route guard
    login-form.tsx           login/sign-up form, posts to /api/auth/login
    dashboard.tsx             catalog grid; only the Mutual NDA card links out
    nda-builder.tsx           form state, downloads, layout
    nda-form.tsx              the Cover Page fields
    nda-chat.tsx              chat panel; posts to /api/mnda/chat
    nda-preview.tsx           Markdown → HTML
  lib/
    catalog.ts                server-only read of ../catalog.json
    auth/session.ts           localStorage session read/write/clear
    mnda/
      fields.ts               field types, defaults, completeness check
      template.ts             server-only read of ../templates
      render.ts               pure Markdown renderer
      chat.ts                 chat fetch call + reply-vs-sent field diffing
```

## Downloads

- **Download Markdown** — builds the file in the browser and saves it. No server round trip.
- **Print / Save as PDF** — the browser's own print dialog, with print styles that drop the app
  chrome and lay the agreement out on white paper.

Unfilled fields never block either one; they appear as `[Bracketed Placeholders]`, matching how
the source template marks blanks.

## Deploying

The build reads `../templates` and `../catalog.json`, which sit outside this directory. Any build
context that contains only `frontend/` — a Vercel project with the Root Directory set to
`frontend` and "include files outside the root directory" left off, or a Dockerfile that copies
just this folder — will fail at `next build` with `ENOENT`. It fails loudly rather than shipping a
broken document, but the deployment setup has to include the repository root. The root
`Dockerfile` does this: it builds this app in a Node stage with the full repo as context, then
serves the exported `out/` from the FastAPI backend.

## Scope

The Mutual NDA is the only document with a real builder behind it; the other eleven templates in
`catalog.json` show on the dashboard as "Coming soon" and have no field metadata yet. Login is
fake (any email, no password check) and the "session" is just `localStorage` — there is no real
authentication, and no product data persists beyond the `users` row the backend upserts on login.

## Licensing

Documents are based on the [Common Paper Mutual NDA (Version 1.0)](https://commonpaper.com/standards/mutual-nda/1.0),
used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The attribution notice is
part of the rendered document and must stay in any output.

Documents produced here are not legal advice.
