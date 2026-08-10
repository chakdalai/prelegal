"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { NdaPreview } from "@/components/nda-preview";
import { getSession } from "@/lib/auth/session";
import { downloadTextFile } from "@/lib/download";
import {
  formatSavedDocumentTimestamp,
  getDocument,
  type SavedDocumentDetail,
} from "@/lib/saved-documents";

const BUTTON_CLASS =
  "rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1";

function filenameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "document"}.md`;
}

/**
 * Read-only view of one autosaved document, fetched by id from `?id=`. No
 * form, no chat, no `onChange` — nothing here can turn into an edit surface,
 * matching the product decision that saved documents are history to look
 * back at, not resumable drafts.
 */
export function SavedDocumentView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const session = getSession();

  const [status, setStatus] = useState<"loading" | "not-found" | "loaded">("loading");
  const [doc, setDoc] = useState<SavedDocumentDetail | null>(null);

  useEffect(() => {
    if (!id || !session) return;

    let cancelled = false;
    getDocument(id, session.id)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setStatus("not-found");
        } else {
          setDoc(result);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("not-found");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id primitive, not the session object (a fresh object every render)
  }, [id, session?.id]);

  if (!id || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
          This document couldn&apos;t be found.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="p-8 text-sm text-brand-gray">Loading…</p>;
  }

  if (status === "not-found" || !doc) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
          This document couldn&apos;t be found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="no-print mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{doc.title}</h1>
          <p className="mt-1 text-sm text-stone-600">
            Last updated {formatSavedDocumentTimestamp(doc.updatedAt)} — read-only.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className={`${BUTTON_CLASS} border border-stone-300 text-stone-700 hover:bg-stone-100 focus:ring-stone-300`}
            onClick={() => window.print()}
            type="button"
          >
            Print / Save as PDF
          </button>
          <button
            className={`${BUTTON_CLASS} bg-stone-900 text-white hover:bg-stone-700 focus:ring-stone-400`}
            onClick={() => downloadTextFile(filenameFor(doc.title), doc.markdown, "text/markdown")}
            type="button"
          >
            Download Markdown
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-10">
        <NdaPreview markdown={doc.markdown} />
      </div>
    </div>
  );
}
