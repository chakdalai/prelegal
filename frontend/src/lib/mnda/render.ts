import type { ConfidentialityTerm, MndaFormData, MndaTerm, Party } from "./fields";

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

/** A user value, or a bracketed placeholder in the style of the source template. */
function filled(value: string, label: string): string {
  return value.trim() || `[${label}]`;
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
 * Escapes a value for use inside a Markdown table cell. Pipes would end the
 * cell, and newlines would end the row — a multi-line postal address is
 * flattened onto one line rather than emitted as raw `<br>` HTML.
 */
function tableCell(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ")
    .replaceAll("|", "\\|");
}

function partyCell(party: Party, key: keyof Party, label: string): string {
  return tableCell(filled(party[key], label));
}

/** Signature block. Signature and Date are deliberately left blank to be signed. */
function renderSignatureTable(data: MndaFormData): string {
  const row = (label: string, key: keyof Party, cellLabel: string) =>
    `| ${label} | ${partyCell(data.party1, key, cellLabel)} | ${partyCell(
      data.party2,
      key,
      cellLabel,
    )} |`;

  return [
    "| | PARTY 1 | PARTY 2 |",
    "|:--- |:--- |:--- |",
    "| Signature | | |",
    row("Print Name", "signatoryName", "Print Name"),
    row("Title", "signatoryTitle", "Title"),
    row("Company", "company", "Company"),
    row("Notice Address", "noticeAddress", "Notice Address"),
    "| Date | | |",
  ].join("\n");
}

export function renderCoverPage(data: MndaFormData): string {
  return `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose

${filled(data.purpose, "How Confidential Information may be used")}

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

${data.modifications.trim() || "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

${renderSignatureTable(data)}`;
}

/**
 * Resolves the `<span class="coverpage_link">…</span>` cross-references that the
 * Standard Terms use to point at Cover Page fields.
 *
 * Only Governing Law and Jurisdiction are substituted with the user's values,
 * and only on first mention. The surrounding sentences decide this:
 *
 * - Section 9 reads "the laws of the State of X, without regard to the conflict
 *   of laws provisions of such X". The value fits the first slot but not the
 *   second, which would become "of such Delaware", so repeat mentions keep the
 *   defined term.
 * - Section 5 reads "commences on the ⟨Effective Date⟩", where a date would
 *   leave a dangling article. Like Purpose, MNDA Term and Term of
 *   Confidentiality, it stays a defined term — all four are set out in full on
 *   the Cover Page, which is where a reader looks for their values.
 */
export function fillStandardTerms(standardTerms: string, data: MndaFormData): string {
  const inlineValues: Record<string, string> = {
    "Governing Law": data.governingLaw.trim(),
    Jurisdiction: data.jurisdiction.trim(),
  };
  const seen = new Set<string>();

  return standardTerms.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    (_match, label: string) => {
      const value = seen.has(label) ? "" : inlineValues[label];
      seen.add(label);

      return `**${value || label}**`;
    },
  );
}

/** The complete agreement: Cover Page followed by the resolved Standard Terms. */
export function renderMnda(data: MndaFormData, standardTerms: string): string {
  return `${renderCoverPage(data)}\n\n---\n\n${fillStandardTerms(standardTerms, data)}\n`;
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
