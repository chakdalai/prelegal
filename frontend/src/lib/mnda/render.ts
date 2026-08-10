import { ensureDraftDisclaimer } from "@/lib/disclaimer";

import {
  PARTY_FIELD_LABELS,
  type ConfidentialityTerm,
  type MndaFormData,
  type MndaTerm,
  type Party,
} from "./fields";

/**
 * Renders a completed Mutual NDA as Markdown.
 *
 * The two halves of the agreement are handled differently, on purpose:
 *
 * - The **Cover Page** is generated here from the user's answers. The source
 *   template's cover page is a blank form — checkboxes, `<label>` hints,
 *   bracketed prompts — so patching strings into it would be fragile. This
 *   module reproduces its structure with the answers filled in.
 * - The **Standard Terms** are passed in verbatim from `templates/mutual-nda.md`
 *   and only have their cover-page cross-references resolved.
 *
 * Every function here is pure, so the live preview, the Markdown download and
 * the print view are guaranteed to show the same document.
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

/**
 * Formats an ISO `yyyy-mm-dd` date as e.g. `August 9, 2026`, or `""` if the
 * input is not a complete date.
 *
 * The string is parsed by hand rather than via `new Date(iso)`, which would
 * read it as UTC midnight and render as the previous day west of Greenwich.
 */
export function formatEffectiveDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || Number(day) < 1 || Number(day) > 31) return "";

  return `${monthName} ${Number(day)}, ${year}`;
}

/**
 * Everything the user types is escaped before it reaches the document. Without
 * this, a company name ending in `**` would open an emphasis span that runs on
 * through the clauses that follow, and a `#` typed into Purpose would become a
 * heading indistinguishable from the agreement's own.
 */
const INLINE_MARKDOWN = /[\\`*_[\]<>|]/g;

function escapeInline(value: string): string {
  return value.replace(INLINE_MARKDOWN, (character) => `\\${character}`);
}

/**
 * Escapes a value that occupies whole lines, where Markdown reads headings,
 * block quotes, list markers and thematic breaks at the start of a line as well.
 */
function escapeBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => escapeInline(line).replace(/^(\s*)([#>=~+-]|\d+[.)])/, "$1\\$2"))
    .join("\n");
}

/**
 * An escaped user value, or a bracketed placeholder in the style of the source
 * template. Escaping happens first so the placeholder's own brackets survive.
 */
function filled(value: string, label: string): string {
  return escapeInline(value.trim()) || `[${label}]`;
}

/** As {@link filled}, for the multi-line fields. */
function filledBlock(value: string, label: string): string {
  return escapeBlock(value.trim()) || `[${label}]`;
}

function pluralYears(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function describeMndaTerm(term: MndaTerm): string {
  return term.kind === "expires"
    ? `Expires ${pluralYears(term.years)} from the Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

function describeConfidentialityTerm(term: ConfidentialityTerm): string {
  return term.kind === "years"
    ? `${pluralYears(term.years)} from the Effective Date, but in the case of trade secrets ` +
        "until the Confidential Information is no longer considered a trade secret under " +
        "applicable laws."
    : "In perpetuity.";
}

/**
 * Prepares a value for a Markdown table cell. A newline would end the row, so a
 * multi-line postal address is flattened onto one line rather than emitted as
 * raw `<br>` HTML.
 */
function tableCell(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

/** Row order of the signature block, as laid out on the Cover Page. */
const SIGNATURE_ROWS: Array<keyof Party> = [
  "signatoryName",
  "signatoryTitle",
  "company",
  "noticeAddress",
];

/** Signature block. Signature and Date are deliberately left blank to be signed. */
function renderSignatureTable(data: MndaFormData): string {
  const cell = (party: Party, key: keyof Party) =>
    tableCell(filled(party[key], PARTY_FIELD_LABELS[key]));

  const row = (key: keyof Party) =>
    `| ${PARTY_FIELD_LABELS[key]} | ${cell(data.party1, key)} | ${cell(data.party2, key)} |`;

  return [
    "| | PARTY 1 | PARTY 2 |",
    "|:--- |:--- |:--- |",
    "| Signature | | |",
    ...SIGNATURE_ROWS.map(row),
    "| Date | | |",
  ].join("\n");
}

export function renderCoverPage(data: MndaFormData): string {
  return `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose

${filledBlock(data.purpose, "How Confidential Information may be used")}

### Effective Date

${filled(formatEffectiveDate(data.effectiveDate), "Effective Date")}

### MNDA Term

${describeMndaTerm(data.mndaTerm)}

### Term of Confidentiality

${describeConfidentialityTerm(data.confidentialityTerm)}

### Governing Law & Jurisdiction

Governing Law: ${filled(data.governingLaw, "Governing Law")}

Jurisdiction: ${filled(data.jurisdiction, "Jurisdiction")}

### MNDA Modifications

${escapeBlock(data.modifications.trim()) || "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

${renderSignatureTable(data)}`;
}

/**
 * Renders the `<span class="coverpage_link">…</span>` cross-references that the
 * Standard Terms use to point at Cover Page fields.
 *
 * No user value is substituted here, and that is deliberate. The Cover Page
 * declares the Standard Terms "identical to those posted at
 * commonpaper.com/standards/mutual-nda/1.0", and the published text carries
 * these as defined terms rather than values — section 9 reads "the laws of the
 * State of Governing Law, without regard to the conflict of laws provisions of
 * such Governing Law". Substituting would break both that representation and,
 * on the second mention, the sentence itself ("of such Delaware").
 *
 * The Standard Terms are invariant boilerplate; every deal-specific value
 * belongs on the Cover Page, which is where a reader looks for it.
 */
export function resolveCrossReferences(standardTerms: string): string {
  return standardTerms.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    (_match, label: string) => `**${label}**`,
  );
}

/** The complete agreement: Cover Page followed by the Standard Terms. */
export function renderMnda(data: MndaFormData, standardTerms: string): string {
  return ensureDraftDisclaimer(
    `${renderCoverPage(data)}\n\n---\n\n${resolveCrossReferences(standardTerms)}\n`,
  );
}

/** Display title for a saved document's history entry, distinguishing drafts by party. */
export function documentTitle(data: MndaFormData): string {
  const parties = [data.party1.company, data.party2.company].filter((company) => company.trim());
  return parties.length ? `Mutual NDA — ${parties.join(" / ")}` : "Mutual NDA";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Download filename, named after the parties when they are known. */
export function documentFilename(data: MndaFormData): string {
  const parties = [data.party1.company, data.party2.company]
    .map(slug)
    .filter(Boolean)
    .join("-and-");

  return parties ? `mutual-nda-${parties}.md` : "mutual-nda.md";
}
