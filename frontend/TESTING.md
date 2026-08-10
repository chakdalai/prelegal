# Testing

```bash
npm test          # unit + component (Vitest)
npm run test:e2e  # end-to-end in a real browser (Playwright)
npm run lint      # ESLint
npx tsc --noEmit  # types
```

## What is covered automatically

| Layer | Where | What it holds down |
| --- | --- | --- |
| Renderer | `src/lib/mnda/render.test.ts` | Date formatting across time zones, bracketed placeholders, table-cell escaping, both term options, filename slugging, cross-reference resolution |
| Real template | `src/lib/mnda/template.test.ts` | The agreement renders from the actual `templates/mutual-nda.md` with nothing unresolved — fails if that file grows a marker the renderer does not know. Also holds the generated Cover Page against `templates/mutual-nda-coverpage.md`, so a field renamed or added upstream fails rather than being silently dropped |
| Escaping | `src/lib/mnda/render.test.ts` | Headings, rules, list markers and emphasis typed into the form stay literal text instead of restructuring the agreement |
| Download helper | `src/lib/download.test.ts` | Blob type, filename, object URL released |
| UI | `src/components/nda-builder.test.tsx` | Typing updates the agreement, the outstanding-fields notice, the Today button, term radios, download filename, print dialog invoked |
| Chat service | `src/lib/mnda/chat.test.ts` | Posts the transcript and current fields to `/api/mnda/chat`, parses the reply, throws on a failed request |
| Chat UI | `src/components/nda-chat.test.tsx` | Greets before anything is sent; a turn shows the reply and applies the returned fields; a failed request keeps the message and shows an error without touching the fields; an empty message is not sent |
| Session storage | `src/lib/auth/session.test.ts` | Round-trips through `localStorage`, clears, and treats malformed stored data as no session |
| Catalog | `src/lib/catalog.test.ts` | `catalog.json` reads as 12 entries with the expected shape |
| Route guard | `src/components/require-session.test.tsx` | Redirects to `/login` with no session; renders children with one |
| Login form | `src/components/login-form.test.tsx` | Sends only the email (never the password) to the backend, stores the session and redirects on success, shows an error and does not redirect on failure |
| Dashboard | `src/components/dashboard.test.tsx` | Only the Mutual NDA Cover Page links out; the other 11 catalog entries render as inert "Coming soon" cards; sign-out clears the session |
| End to end | `e2e/mutual-nda.spec.ts` | A real download landing on disk with the right contents, print stylesheet hiding app chrome, a real multi-page PDF, a chat reply (stubbed `POST /api/mnda/chat`) updating the form and preview |
| End to end | `e2e/auth.spec.ts` | Unauthenticated visits to `/dashboard` and `/nda` redirect to `/login`; signing in (backend stubbed) reaches the dashboard and opens the builder; signing out re-gates the dashboard |

The E2E suite runs against the **static export** (`next build`, served by `serve`), which is what
the backend ships in Docker — this also exercises the static prerender that inlines the template.
`e2e/auth.spec.ts` stubs `POST /api/auth/login`, and `e2e/mutual-nda.spec.ts`'s chat test stubs
`POST /api/mnda/chat`, rather than running the real backend or calling the LLM; those endpoints
have their own coverage in `backend/tests/` (`uv run pytest` from `backend/`), with the LLM call
itself mocked (`test_mnda_chat.py` monkeypatches `litellm.completion`).

## What still needs a human

Automation cannot judge these. Run them before a release, and whenever the print styles or the
document structure change.

### Print and PDF

The E2E suite proves Chromium produces a multi-page PDF and that app chrome is hidden. It does
not judge whether the result *looks* right.

- [ ] **Ctrl/Cmd-P in a real browser.** The preview should show the agreement alone on white
      paper — no form, no buttons, no notice banner.
- [ ] **Page breaks.** No heading stranded at the foot of a page; the signature table is not
      split across two pages.
- [ ] **Save as PDF, then open the file.** Text is selectable, links are live, margins are even.
- [ ] Repeat in **Firefox** and **Safari** — print CSS support differs most between engines, and
      only Chromium is covered automatically.
- [ ] Print to **A4 and US Letter**. The document is US-centric but the app is not.

### The document itself

- [ ] **Have a lawyer read a completed agreement.** Nothing in this repository can tell you the
      output is legally sound; the tests only prove it says what the template says.
- [ ] Compare a rendered agreement against
      [the published Common Paper MNDA](https://commonpaper.com/standards/mutual-nda/1.0)
      clause by clause after any template update.
- [ ] Confirm the CC BY 4.0 attribution survives in every output — it is a licence condition.

### Input handling

- [ ] Very long company names and multi-line postal addresses — check the signature table still
      holds its shape in both preview and print.
- [ ] Non-Latin names and addresses (e.g. Japanese, Arabic) render and download intact.
- [ ] Markdown metacharacters are escaped and covered by tests, but confirm by eye that an
      escaped value still *reads* correctly in the preview and in the downloaded `.md` — the
      backslashes are invisible when rendered but present in the file.

### AI chat

No automated test calls the real model — every test stubs or monkeypatches the LLM response, so
none of them can catch the model behaving badly.

- [ ] **Have a real conversation** against a Docker build (`scripts/start-linux.sh` etc., with
      `OPENROUTER_API_KEY` set in `.env`): confirm the assistant asks sensible follow-up questions,
      doesn't fabricate values (especially governing law, jurisdiction, or a party's legal name),
      and eventually reports the agreement complete.
- [ ] Confirm a manual edit to the form survives a later chat turn that doesn't mention that field
      (the merge in `backend/app/mnda_schema.py::merge_patch` should leave it alone).
- [ ] Try adversarial input (prompt injection, a request for legal advice, a nonsense field value)
      and confirm the assistant declines gracefully rather than corrupting the fields.

**If the chat shows "temporarily unavailable":** this is usually a transient upstream error, not a
code bug — confirmed live during PL-5 development as a `429` from OpenRouter's shared free-tier
pool for `gpt-oss-120b` under repeated rapid requests (`docker logs prelegal` shows the real cause;
`backend/app/llm.py` logs the full exception before collapsing it into the generic 502 the client
sees). It clears on its own or with your own OpenRouter key accumulating separate quota.

### Accessibility

- [ ] Tab through the whole form. Every control reachable, focus always visible, order sensible.
- [ ] Screen reader (NVDA or VoiceOver): each field announces its label and hint; the
      outstanding-fields notice announces when it changes.
- [ ] Zoom to 200% and check nothing is clipped or overlapping.
- [ ] No automated accessibility audit (axe) is wired up yet.

### Responsive

- [ ] Narrow viewport (~375px): the form stacks above the agreement and stays usable.
- [ ] The agreement's signature table scrolls or reflows rather than forcing the page sideways.

## Known gaps

- Only Chromium is covered by E2E.
- No visual regression testing — a broken stylesheet would pass every check here.
- No test asserts the rendered agreement is *legally* correct, only that it is faithful to the
  template.
