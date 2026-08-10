# document-fields

One JSON config per catalog document that isn't the Mutual NDA (which keeps its own hand-typed
fields in `frontend/src/lib/mnda/fields.ts` / `backend/app/mnda_schema.py` instead — see
`CLAUDE.md`'s AI chat design notes for why). Each file drives that document's generated Cover
Page, manual form, and chat, on both the frontend (`frontend/src/lib/documents/registry.ts`, read
at build time) and the backend (`backend/app/document_fields.py`, read at runtime to build a
dynamic Pydantic model per document).

## Shape

```json
{
  "slug": "cloud-service-agreement",
  "filename": "cloud-service-agreement.md",
  "title": "Cloud Service Agreement",
  "party1Label": "Provider",
  "party2Label": "Customer",
  "fields": [
    { "name": "effectiveDate", "label": "Effective Date", "type": "date" },
    { "name": "generalCapAmount", "label": "General Cap Amount", "type": "text", "helpText": "optional" }
  ]
}
```

- `slug` — matches the filename (without `.json`) and the route segment (`/documents/[slug]/`).
- `filename` — the corresponding template in `../templates/`, read verbatim and rendered below
  the generated Cover Page.
- `title` — heading text for the generated Cover Page and the builder page.
- `party1Label`/`party2Label` — the two parties' own names in that document (e.g.
  "Provider"/"Customer", "Company"/"Partner"), used on the signature block and the manual form's
  section headings. Every document gets the same signature fields per party (company, print name,
  title, notice address) — only the labels differ.
- `fields` — one entry per deal-specific value, in the order they should appear on the Cover Page
  and the form:
  - `name` — camelCase key, used as the property name in `DocumentFormData.values` on the wire.
  - `label` — shown on the form and in the generated Cover Page's headings.
  - `type` — `"text"` (single line), `"textarea"` (multi-line), or `"date"`. No richer per-field
    types (e.g. an election between two choices, like the Mutual NDA's `MndaTerm`) — deliberately
    traded for being able to cover every document with one generic engine. If a document needs
    that, it's a real signal to build a second special case, not to add union types here.
  - `helpText` — optional, shown as a hint under the form field.

## Adding a document

1. Add the template to `../templates/` and an entry to `../catalog.json` first, if not already
   present.
2. Read the template for its `coverpage_link`/`orderform_link`/`keyterms_link`/
   `businessterms_link`/`sow_link` spans — those are the values that need a field here. Fold a
   term's possessive or plural variants (`Provider`/`Provider's`, `Customer Covered Claim`/
   `Customer Covered Claims`) into one field; bare party names (`Provider`, `Customer`) aren't
   fields at all — they're that party's `company` value, already covered by the signature block.
3. Add `<slug>.json` here, matching the shape above.
4. `frontend/src/lib/documents/registry.test.ts` and `render.test.ts` will pick it up
   automatically (they're parameterized over every config) — run `npm test` to check the new
   config's fields all round-trip and the template renders with no unresolved cross-references.
