# Prelegal

Platform for drafting common legal agreements. See [CLAUDE.md](CLAUDE.md) for the full project
overview and [catalog.json](catalog.json) for the document catalog.

## Status

🚧 **Work in progress.** This project is under active development and is targeted for
completion by **16 August 2026** (one week from 9 August 2026).

The technical foundation (frontend, backend, database, Docker packaging) is now in place; a fake
login screen is the only auth so far, and only the Mutual NDA has a working builder behind it.
Expect breaking changes until the first release.

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
  `catalog.json`, and a working Mutual NDA creator: fill in the deal-specific terms, preview the
  agreement as it builds, and download it as Markdown or PDF. See
  [frontend/README.md](frontend/README.md).
- `backend/` — FastAPI app (uv project). See [backend/README.md](backend/README.md).
- `templates/` — curated legal agreement templates, the single source of truth for document text.
- `catalog.json` — indexes the templates in `templates/`.
- `scripts/` — start/stop the Docker container, per platform.

## Developing

The frontend (`npm run dev`) and backend (`uv run uvicorn app.main:app --reload`) can each be run
directly on the host for iteration — see their READMEs — but login only works end to end when
both are reachable from the same origin, which is what Docker provides.

## Roadmap to completion

- [ ] Core agreement drafting engine
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
