import type { MndaFormData } from "./fields";

/**
 * The service boundary for the Mutual NDA chat. Stateless: each call sends
 * the full transcript and current field snapshot, and gets back a reply
 * plus the new full snapshot (the backend merges the LLM's patch in, so
 * there is no merge logic on the frontend for the request/response shape
 * itself — see {@link fieldsPatchSince} for why a diff is still needed
 * before applying it).
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurnResult {
  reply: string;
  fields: MndaFormData;
}

export async function sendChatTurn(
  messages: ChatMessage[],
  fields: MndaFormData,
): Promise<ChatTurnResult> {
  const response = await fetch("/api/mnda/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, fields }),
  });

  if (!response.ok) {
    throw new Error("chat request failed");
  }

  return response.json();
}

/**
 * The fields a chat turn actually changed, as a patch: `sent` is the
 * snapshot posted with the request, `received` is the (fully merged)
 * snapshot that came back.
 *
 * A round trip can take a few seconds, during which the user may have kept
 * editing the form. Applying `received` wholesale would overwrite that edit
 * with the stale value `sent` still had for it. Diffing against `sent`
 * instead yields a patch with only the fields the LLM actually touched, so
 * it can be merged onto whatever the form's live state is by the time the
 * reply arrives — the same way `NdaForm`'s own edits already are.
 */
export function fieldsPatchSince(
  sent: MndaFormData,
  received: MndaFormData,
): Partial<MndaFormData> {
  const patch: Partial<MndaFormData> = {};

  if (sent.purpose !== received.purpose) patch.purpose = received.purpose;
  if (sent.effectiveDate !== received.effectiveDate) patch.effectiveDate = received.effectiveDate;
  if (sent.governingLaw !== received.governingLaw) patch.governingLaw = received.governingLaw;
  if (sent.jurisdiction !== received.jurisdiction) patch.jurisdiction = received.jurisdiction;
  if (sent.modifications !== received.modifications) patch.modifications = received.modifications;

  if (JSON.stringify(sent.mndaTerm) !== JSON.stringify(received.mndaTerm)) {
    patch.mndaTerm = received.mndaTerm;
  }
  if (JSON.stringify(sent.confidentialityTerm) !== JSON.stringify(received.confidentialityTerm)) {
    patch.confidentialityTerm = received.confidentialityTerm;
  }
  if (JSON.stringify(sent.party1) !== JSON.stringify(received.party1)) {
    patch.party1 = received.party1;
  }
  if (JSON.stringify(sent.party2) !== JSON.stringify(received.party2)) {
    patch.party2 = received.party2;
  }

  return patch;
}
