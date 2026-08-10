import type { Party } from "@/lib/party";

import type { DocumentFormData } from "./fields";

/**
 * The service boundary for a generic document's chat, one per non-Mutual-NDA
 * catalog document. As `lib/mnda/chat.ts`: stateless, full transcript and
 * current field snapshot sent each turn, reply plus the new full snapshot
 * (fields already merged server-side) returned.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurnResult {
  reply: string;
  fields: DocumentFormData;
}

export async function sendChatTurn(
  slug: string,
  messages: ChatMessage[],
  fields: DocumentFormData,
): Promise<ChatTurnResult> {
  const response = await fetch(`/api/documents/${slug}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, fields }),
  });

  if (!response.ok) {
    throw new Error("chat request failed");
  }

  return response.json();
}

function partyChanged(sent: Party, received: Party): boolean {
  return (Object.keys(sent) as Array<keyof Party>).some((key) => sent[key] !== received[key]);
}

/**
 * As `lib/mnda/chat.ts::fieldsPatchSince`: the fields a chat turn actually
 * changed, diffed against the snapshot that was *sent* rather than applied
 * wholesale, so a form edit made while the reply was in flight survives.
 * `party1`/`party2` replace wholesale when any of their fields changed —
 * matching how the backend patches a party (see `merge_patch`, generalized).
 */
export function fieldsPatchSince(
  sent: DocumentFormData,
  received: DocumentFormData,
): Partial<DocumentFormData> {
  const patch: Partial<DocumentFormData> = {};
  const values: Record<string, string> = {};
  let valuesChanged = false;

  for (const key of Object.keys(sent.values)) {
    if (sent.values[key] !== received.values[key]) {
      values[key] = received.values[key];
      valuesChanged = true;
    }
  }
  if (valuesChanged) patch.values = values;

  if (partyChanged(sent.party1, received.party1)) patch.party1 = received.party1;
  if (partyChanged(sent.party2, received.party2)) patch.party2 = received.party2;

  return patch;
}
