# Prelegal

Platform for drafting common legal agreements. See [CLAUDE.md](CLAUDE.md) for the full project
overview and [catalog.json](catalog.json) for the document catalog.

## Status

🚧 **Work in progress.** This project is under active development and is targeted for
completion by **16 August 2026** (one week from 9 August 2026).

The technical foundation (frontend, backend, database, Docker packaging) is now in place; a fake
login screen is the only auth so far. Every document in `catalog.json` has a working builder
behind it — filled in either by chatting with an AI assistant or editing the form directly — and a
chat on the dashboard points an unsure user to the closest one. Expect breaking changes until the
first release.

## Running the whole stack

```bash
# Mac
scripts/start-mac.sh
scripts/stop-mac.sh

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

The start scripts build a single Docker image (frontend statically exported, served by the
FastAPI backend) and run it at <http://localhost:8000>. The SQLite database is recreated from
scratch every time the container starts — nothing persists between runs yet.

## Layout

- `frontend/` — Next.js app (static export). It offers a dashboard listing every document in
  `catalog.json` — each with a working creator: fill in the deal-specific terms by chatting with
  an AI assistant or editing the form directly, preview the agreement as it builds, and download it
  as Markdown or PDF — plus a chat that points an unsure user to the closest document. See
  [frontend/README.md](frontend/README.md).
- `backend/` — FastAPI app (uv project). See [backend/README.md](backend/README.md).
- `templates/` — curated legal agreement templates, the single source of truth for document text.
- `catalog.json` — indexes the templates in `templates/`.
- `document-fields/` — one JSON config per non-Mutual-NDA document (field names, labels, types,
  and each party's own label), driving that document's generated Cover Page, form and chat.
- `scripts/` — start/stop the Docker container, per platform.

## Developing

The frontend (`npm run dev`) and backend (`uv run uvicorn app.main:app --reload`) can each be run
directly on the host for iteration — see their READMEs — but login and any of the chat features
only work end to end when both are reachable from the same origin, which is what Docker provides.
Chat also needs `OPENROUTER_API_KEY` set in the root `.env`.

## Roadmap to completion

- [x] Core agreement drafting engine
- [x] Initial set of supported agreement templates
- [x] Getting started / installation instructions
- [ ] Usage examples
- [ ] Contributing guidelines

Progress is tracked in [issues](https://github.com/chakdalai/prelegal/issues).

## License

See [LICENSE](LICENSE).

## Disclaimer

Documents produced by this project are not legal advice. Consult a qualified lawyer
before relying on any generated agreement.
