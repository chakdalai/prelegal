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

Not yet built: there is no backend, Docker container, database or scripts directory. The frontend
currently runs standalone via `npm run dev` in frontend/.

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
npm run test:e2e  # Playwright; builds for production first, so it cannot share
                  # a port with a running dev server
```

`frontend/TESTING.md` records what the tests cover and what still needs a human.

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

Not yet applied — the frontend currently uses a neutral stone palette.

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

### Outstanding
- PL-1: marketing site describing the company — still To Do
- No backend, authentication, persistence, Docker packaging or AI chat yet

### Current API Endpoints
None — there is no backend yet.
