/**
 * The service boundary for a user's saved document history, mirroring
 * `lib/mnda/chat.ts`'s style: a thin `fetch` wrapper per endpoint, throwing a
 * plain `Error` on `!response.ok`.
 */

export interface SavedDocumentSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedDocumentDetail extends SavedDocumentSummary {
  formData: Record<string, unknown>;
  markdown: string;
}

/**
 * `createdAt`/`updatedAt` are stored as SQLite's `datetime('now')`, UTC
 * without a timezone suffix — append one so `Date` parses it as UTC rather
 * than the browser's local time.
 */
export function formatSavedDocumentTimestamp(iso: string): string {
  const date = new Date(`${iso}Z`);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function saveDocument(input: {
  id: string;
  userId: string;
  slug: string;
  title: string;
  formData: unknown;
  markdown: string;
}): Promise<SavedDocumentDetail> {
  const response = await fetch(`/api/saved-documents/${input.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      slug: input.slug,
      title: input.title,
      formData: input.formData,
      markdown: input.markdown,
    }),
  });

  if (!response.ok) {
    throw new Error("save document request failed");
  }

  return response.json();
}

export async function listDocuments(userId: string): Promise<SavedDocumentSummary[]> {
  const response = await fetch(`/api/saved-documents?userId=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error("list documents request failed");
  }

  return response.json();
}

export async function getDocument(
  id: string,
  userId: string,
): Promise<SavedDocumentDetail | null> {
  const response = await fetch(
    `/api/saved-documents/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("get document request failed");
  }

  return response.json();
}
