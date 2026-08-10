import { PARTY_FIELD_LABELS, type Party } from "@/lib/party";

import type { DocumentFormData } from "./fields";
import type { DocumentConfig, FieldConfig } from "./registry";

/**
 * Renders a completed document as Markdown, generically across the eleven
 * catalog documents that aren't the Mutual NDA.
 *
 * Unlike the Mutual NDA, none of these templates ship with their own blank
 * Cover Page in `templates/` — they are pure Standard Terms, prose that only
 * cross-references deal-specific values by name (`coverpage_link`,
 * `keyterms_link`, `orderform_link`, `businessterms_link`, `sow_link` spans).
 * This module generates a Cover Page from `DocumentConfig.fields` instead of
 * reproducing a curated one, then appends the Standard Terms verbatim with
 * only those cross-references resolved to bold defined-term references —
 * never to the user's actual values, for the same reason documented in
 * `lib/mnda/render.ts`'s `resolveCrossReferences`.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** As `lib/mnda/render.ts`'s `formatEffectiveDate`: parsed by hand so a date never shifts by one day west of Greenwich. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || Number(day) < 1 || Number(day) > 31) return "";

  return `${monthName} ${Number(day)}, ${year}`;
}

const INLINE_MARKDOWN = /[\\`*_[\]<>|]/g;

function escapeInline(value: string): string {
  return value.replace(INLINE_MARKDOWN, (character) => `\\${character}`);
}

function escapeBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => escapeInline(line).replace(/^(\s*)([#>=~+-]|\d+[.)])/, "$1\\$2"))
    .join("\n");
}

function filled(value: string, label: string): string {
  return escapeInline(value.trim()) || `[${label}]`;
}

function filledBlock(value: string, label: string): string {
  return escapeBlock(value.trim()) || `[${label}]`;
}

function tableCell(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

function renderField(field: FieldConfig, rawValue: string): string {
  const display = field.type === "date" ? formatDate(rawValue) : rawValue;
  const body =
    field.type === "textarea" ? filledBlock(display, field.label) : filled(display, field.label);

  return `### ${field.label}\n\n${body}`;
}

const SIGNATURE_ROWS: Array<keyof Party> = [
  "signatoryName",
  "signatoryTitle",
  "company",
  "noticeAddress",
];

function renderSignatureTable(config: DocumentConfig, data: DocumentFormData): string {
  const cell = (party: Party, key: keyof Party) =>
    tableCell(filled(party[key], PARTY_FIELD_LABELS[key]));

  const row = (key: keyof Party) =>
    `| ${PARTY_FIELD_LABELS[key]} | ${cell(data.party1, key)} | ${cell(data.party2, key)} |`;

  return [
    `| | ${config.party1Label.toUpperCase()} | ${config.party2Label.toUpperCase()} |`,
    "|:--- |:--- |:--- |",
    "| Signature | | |",
    ...SIGNATURE_ROWS.map(row),
    "| Date | | |",
  ].join("\n");
}

export function renderCoverPage(config: DocumentConfig, data: DocumentFormData): string {
  const fields = config.fields
    .map((field) => renderField(field, data.values[field.name] ?? ""))
    .join("\n\n");

  return `# ${config.title}

## Cover Page

${fields}${fields ? "\n\n" : ""}By signing this Cover Page, each party agrees to enter into this ${config.title} as of the date below.

${renderSignatureTable(config, data)}`;
}

// Unlike `templates/mutual-nda.md`'s coverpage_link spans, these templates
// sometimes pair the link class with an `id` attribute on the same span
// (e.g. `<span class="coverpage_link" id="4.5.a">`), for internal section
// anchors — `[^>]*` on both sides of the class attribute so the match
// doesn't depend on attribute order.
const LINK_SPAN =
  /<span[^>]*\bclass="(?:coverpage_link|orderform_link|keyterms_link|businessterms_link|sow_link)"[^>]*>([^<]+)<\/span>/g;

/**
 * As `lib/mnda/render.ts`'s `resolveCrossReferences`, generalized to the five
 * span classes these templates use for the same purpose (a reference to a
 * value defined elsewhere, not the value itself).
 */
export function resolveCrossReferences(standardTerms: string): string {
  return standardTerms.replace(LINK_SPAN, (_match, label: string) => `**${label}**`);
}

const HAS_ATTRIBUTION = /CC BY 4\.0/;

/**
 * Unlike `templates/mutual-nda.md`, these ten templates carry no inline CC BY
 * 4.0 attribution of their own — the licence notice lives only in
 * `templates/LICENSE.txt`, a directory-level file this app never surfaces to
 * a user. The attribution is a licence condition, not decoration (see
 * CLAUDE.md), so it is appended here whenever the template text doesn't
 * already carry one.
 */
export function ensureAttribution(config: DocumentConfig, standardTerms: string): string {
  if (HAS_ATTRIBUTION.test(standardTerms)) return standardTerms;

  return `${standardTerms}\n\nCommon Paper ${config.title} template, free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`;
}

/** The complete agreement: generated Cover Page followed by the Standard Terms. */
export function renderDocument(
  config: DocumentConfig,
  data: DocumentFormData,
  standardTerms: string,
): string {
  const body = ensureAttribution(config, resolveCrossReferences(standardTerms));
  return `${renderCoverPage(config, data)}\n\n---\n\n${body}\n`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Download filename, named after the parties when they are known. */
export function documentFilename(config: DocumentConfig, data: DocumentFormData): string {
  const base = slug(config.title);
  const parties = [data.party1.company, data.party2.company]
    .map(slug)
    .filter(Boolean)
    .join("-and-");

  return parties ? `${base}-${parties}.md` : `${base}.md`;
}
