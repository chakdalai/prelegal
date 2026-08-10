"use client";

import { useEffect, useRef, useState } from "react";

import { getSession } from "@/lib/auth/session";
import { saveDocument } from "@/lib/saved-documents";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;

function generateDocumentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. older browsers).
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Autosaves a builder's in-progress document to the signed-in user's history
 * as they edit, debounced so a burst of edits produces one write rather than
 * one per keystroke.
 *
 * Generic over the builder's own form-data shape (`T`): the Mutual NDA and
 * the generic document builder both call this with their own state type,
 * without either builder needing to know about the other or this hook
 * needing to understand either shape — it only ever JSON-serializes `data`.
 *
 * Nothing is saved until `data` first differs from the value it held on
 * mount (each builder's own default/empty state), so simply opening a
 * builder page never creates an empty history row. The document id is
 * minted once, client-side, on the first real save and reused for every
 * save after that, turning every write into the same idempotent upsert.
 */
export function useAutosave<T>({
  slug,
  title,
  data,
  markdown,
}: {
  slug: string;
  title: string;
  data: T;
  markdown: string;
}): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const initialDataRef = useRef(data);
  const documentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    if (JSON.stringify(data) === JSON.stringify(initialDataRef.current)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      const documentId = documentIdRef.current ?? generateDocumentId();
      documentIdRef.current = documentId;
      setStatus("saving");

      saveDocument({ id: documentId, userId: session.id, slug, title, formData: data, markdown })
        .then(() => {
          if (!cancelled) setStatus("saved");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, markdown, slug, title]);

  return status;
}
