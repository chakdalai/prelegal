"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getSession } from "@/lib/auth/session";
import {
  formatSavedDocumentTimestamp,
  listDocuments,
  type SavedDocumentSummary,
} from "@/lib/saved-documents";

/**
 * "Your documents" section on the dashboard: everything the signed-in user
 * has autosaved while drafting, most recently updated first. Read-only by
 * design — each entry links to a static preview, never back into a builder.
 */
export function DocumentHistoryList() {
  const [documents, setDocuments] = useState<SavedDocumentSummary[] | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    let cancelled = false;
    listDocuments(session.id)
      .then((result) => {
        if (!cancelled) setDocuments(result);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!documents || documents.length === 0) return null;

  return (
    <section aria-label="Your documents" className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-gray">
        Your documents
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <Link
            className="rounded-lg border border-stone-200 bg-white p-4 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
            href={`/documents/view/?id=${encodeURIComponent(doc.id)}`}
            key={doc.id}
          >
            <p className="font-medium text-brand-navy">{doc.title}</p>
            <p className="mt-1 text-sm text-stone-500">
              Last updated {formatSavedDocumentTimestamp(doc.updatedAt)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
