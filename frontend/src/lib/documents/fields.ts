import { createEmptyParty, PARTY_FIELD_LABELS, type Party } from "@/lib/party";

import type { DocumentConfig } from "./registry";

/**
 * The generic counterpart of `lib/mnda/fields.ts`'s `MndaFormData`, for the
 * eleven catalog documents that don't get their own hand-typed shape.
 * `values` is keyed by each field's `name` from the document's `DocumentConfig`.
 */
export interface DocumentFormData {
  values: Record<string, string>;
  party1: Party;
  party2: Party;
}

export function createDefaultFormData(config: DocumentConfig): DocumentFormData {
  const values: Record<string, string> = {};
  for (const field of config.fields) values[field.name] = "";

  return { values, party1: createEmptyParty(), party2: createEmptyParty() };
}

/**
 * Labels of the fields still needed for a complete agreement.
 *
 * Incomplete fields never block the preview or a download; they render as
 * `[Bracketed Placeholders]`, matching how the Mutual NDA's own Cover Page
 * marks blanks.
 */
export function missingFieldLabels(config: DocumentConfig, data: DocumentFormData): string[] {
  const missing: string[] = [];

  for (const field of config.fields) {
    if (!(data.values[field.name] ?? "").trim()) missing.push(field.label);
  }

  for (const [party, partyLabel] of [
    [data.party1, config.party1Label],
    [data.party2, config.party2Label],
  ] as const) {
    for (const [key, label] of Object.entries(PARTY_FIELD_LABELS)) {
      if (!party[key as keyof Party].trim()) missing.push(`${partyLabel} ${label}`);
    }
  }

  return missing;
}
