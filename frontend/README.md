# Prelegal web app

A prototype for drafting agreements from the templates curated in [`../templates`](../templates).

Currently one document type: the **Mutual NDA creator** (PL-3). Fill in the deal-specific
terms, watch the agreement build as you type, then download it.

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests in a real browser (Playwright) |
| `npm run lint` | ESLint |

See [TESTING.md](TESTING.md) for what is covered and what still needs a human.

## How it works

The Common Paper Mutual NDA has two parts, and this app treats them differently:

- **Standard Terms** — fixed boilerplate. Read verbatim from `../templates/mutual-nda.md`, so
  the repository's `templates/` directory stays the single source of truth. The page is
  statically prerendered, so this read happens at build time and the text is inlined into the
  output; there is no filesystem dependency at runtime.
- **Cover Page** — the deal-specific terms. Generated from the form data rather than
  string-patched into the template, whose cover page is a blank form of checkboxes and
  bracketed prompts.

The Standard Terms cross-reference the Cover Page through
`<span class="coverpage_link">…</span>` markers. `fillStandardTerms` resolves these, using the
user's values only where the surrounding sentence reads correctly with a value in it — see the
comments in `src/lib/mnda/render.ts`.

`renderMnda` is a pure function, so the live preview, the Markdown download and the print view
cannot drift apart. It is where the tests are concentrated.

```
src/
  app/page.tsx              server component; loads the Standard Terms
  components/
    nda-builder.tsx         form state, downloads, layout
    nda-form.tsx            the Cover Page fields
    nda-preview.tsx         Markdown → HTML
  lib/mnda/
    fields.ts               field types, defaults, completeness check
    template.ts             server-only read of ../templates
    render.ts               pure Markdown renderer
```

## Downloads

- **Download Markdown** — builds the file in the browser and saves it. No server round trip.
- **Print / Save as PDF** — the browser's own print dialog, with print styles that drop the app
  chrome and lay the agreement out on white paper.

Unfilled fields never block either one; they appear as `[Bracketed Placeholders]`, matching how
the source template marks blanks.

## Scope

A prototype. There is no persistence — a refresh clears the form — and no backend. The other
eleven templates in `catalog.json` are not wired up yet; they have no field metadata.

## Licensing

Documents are based on the [Common Paper Mutual NDA (Version 1.0)](https://commonpaper.com/standards/mutual-nda/1.0),
used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The attribution notice is
part of the rendered document and must stay in any output.

Documents produced here are not legal advice.
