/**
 * The signature-block shape shared by every document builder: a company plus
 * the person signing for it. Originally specific to the Mutual NDA
 * (`lib/mnda/fields.ts`), pulled out here once the generic document builder
 * (PL-6) needed the identical shape for the other eleven catalog documents.
 */
export interface Party {
  company: string;
  signatoryName: string;
  signatoryTitle: string;
  noticeAddress: string;
}

export function createEmptyParty(): Party {
  return { company: "", signatoryName: "", signatoryTitle: "", noticeAddress: "" };
}

/**
 * A party's own field labels, as they appear on a signature block. Single
 * source of truth so a signature table and an "outstanding fields" notice
 * can't disagree on what to call a field.
 */
export const PARTY_FIELD_LABELS: Record<keyof Party, string> = {
  company: "Company",
  signatoryName: "Print Name",
  signatoryTitle: "Title",
  noticeAddress: "Notice Address",
};
