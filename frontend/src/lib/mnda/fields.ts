/**
 * The deal-specific fields of the Common Paper Mutual NDA.
 *
 * These mirror the Cover Page of `templates/mutual-nda-coverpage.md` one-for-one.
 * The Standard Terms are fixed boilerplate and contribute no fields; they only
 * cross-reference the values captured here.
 */

export { type Party, createEmptyParty, PARTY_FIELD_LABELS } from "@/lib/party";

import { createEmptyParty, PARTY_FIELD_LABELS, type Party } from "@/lib/party";

/** "The length of this MNDA" — the Cover Page offers exactly these two choices. */
export type MndaTerm =
  | { kind: "expires"; years: number }
  | { kind: "untilTerminated" };

/** "How long Confidential Information is protected". */
export type ConfidentialityTerm =
  | { kind: "years"; years: number }
  | { kind: "perpetual" };

export interface MndaFormData {
  purpose: string;
  /** ISO `yyyy-mm-dd`, as produced by an `<input type="date">`. */
  effectiveDate: string;
  mndaTerm: MndaTerm;
  confidentialityTerm: ConfidentialityTerm;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
}

/** The purpose suggested by the Common Paper template itself. */
export const DEFAULT_PURPOSE =
  "Evaluating whether to enter into a business relationship with the other party.";

/**
 * Starting point for a new agreement.
 *
 * Note that `effectiveDate` starts empty rather than defaulting to today: the
 * page is prerendered, so a build-time "today" would go stale on every deploy
 * after the first. The form offers a one-click "Today" button instead.
 */
export function createDefaultFormData(): MndaFormData {
  return {
    purpose: DEFAULT_PURPOSE,
    effectiveDate: "",
    mndaTerm: { kind: "expires", years: 1 },
    confidentialityTerm: { kind: "years", years: 1 },
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: createEmptyParty(),
    party2: createEmptyParty(),
  };
}

/**
 * Labels of the fields still needed for a complete agreement. `modifications`
 * is intentionally excluded — most agreements have none.
 *
 * Incomplete fields never block the preview or a download; they render as
 * `[Bracketed Placeholders]`, matching how the source template marks blanks.
 */
export function missingFieldLabels(data: MndaFormData): string[] {
  const missing: string[] = [];

  if (!data.purpose.trim()) missing.push("Purpose");
  if (!data.effectiveDate.trim()) missing.push("Effective Date");
  if (!data.governingLaw.trim()) missing.push("Governing Law");
  if (!data.jurisdiction.trim()) missing.push("Jurisdiction");

  for (const [party, partyLabel] of [
    [data.party1, "Party 1"],
    [data.party2, "Party 2"],
  ] as const) {
    for (const [key, label] of Object.entries(PARTY_FIELD_LABELS)) {
      if (!party[key as keyof Party].trim()) missing.push(`${partyLabel} ${label}`);
    }
  }

  return missing;
}
