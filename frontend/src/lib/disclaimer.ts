/**
 * The "this is a draft, not legal advice" notice baked into every generated
 * agreement, shared between `lib/mnda/render.ts` and `lib/documents/render.ts`
 * for the same reason `lib/party.ts` is shared: the text and gating logic are
 * identical and unrelated to either builder's own field logic.
 *
 * Pure and idempotent, exactly like `ensureAttribution`
 * (`lib/documents/render.ts`) — gated on "does the text already contain this"
 * so calling it more than once never duplicates the notice.
 */

const DRAFT_DISCLAIMER =
  "> **Draft document — not legal advice.** This agreement was generated automatically by " +
  "Prelegal and has not been reviewed by a lawyer. Have a qualified attorney review it before " +
  "you sign or rely on it.";

const HAS_DRAFT_DISCLAIMER = /has not been reviewed by a lawyer/i;

export function ensureDraftDisclaimer(markdown: string): string {
  if (HAS_DRAFT_DISCLAIMER.test(markdown)) return markdown;
  return `${DRAFT_DISCLAIMER}\n\n${markdown}`;
}
