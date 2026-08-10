/**
 * The service boundary for the dashboard's "not sure which document?" chat
 * (PL-6). Stateless like the document chats: the full transcript is sent
 * each turn. The assistant maps the user's free-form description to the
 * closest catalog document — even an imperfect one, per PL-6 — or asks a
 * follow-up question if it doesn't yet have enough to make that call.
 */

export interface RoutingChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RoutingTurnResult {
  reply: string;
  /** A catalog entry's `filename`, or `null` if nothing suggested yet. */
  suggestedFilename: string | null;
}

export async function sendRoutingTurn(
  messages: RoutingChatMessage[],
): Promise<RoutingTurnResult> {
  const response = await fetch("/api/documents/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error("routing chat request failed");
  }

  return response.json();
}
