"use client";

import { useMemo, useState } from "react";

import { DocumentChat } from "@/components/document-chat";
import { DocumentForm } from "@/components/document-form";
import { NdaPreview } from "@/components/nda-preview";
import { downloadTextFile } from "@/lib/download";
import { createDefaultFormData, missingFieldLabels, type DocumentFormData } from "@/lib/documents/fields";
import { documentFilename, renderDocument } from "@/lib/documents/render";
import type { DocumentConfig } from "@/lib/documents/registry";

const BUTTON_CLASS =
  "rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1";

export interface DocumentBuilderProps {
  config: DocumentConfig;
  /** Verbatim Standard Terms, read from the repository's curated templates. */
  standardTerms: string;
}

export function DocumentBuilder({ config, standardTerms }: DocumentBuilderProps) {
  const [data, setData] = useState<DocumentFormData>(() => createDefaultFormData(config));

  const markdown = useMemo(
    () => renderDocument(config, data, standardTerms),
    [config, data, standardTerms],
  );
  const missing = useMemo(() => missingFieldLabels(config, data), [config, data]);

  const update = (patch: Partial<DocumentFormData>) =>
    setData((current) => ({ ...current, ...patch }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="no-print mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{config.title} creator</h1>
          <p className="mt-1 text-sm text-stone-600">
            Chat with the assistant or fill in the form directly; the agreement updates as you go.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className={`${BUTTON_CLASS} border border-stone-300 text-stone-700 hover:bg-stone-100 focus:ring-stone-300`}
            type="button"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
          <button
            className={`${BUTTON_CLASS} bg-stone-900 text-white hover:bg-stone-700 focus:ring-stone-400`}
            type="button"
            onClick={() => downloadTextFile(documentFilename(config, data), markdown, "text/markdown")}
          >
            Download Markdown
          </button>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="no-print space-y-6">
          <DocumentChat config={config} data={data} onFieldsUpdate={update} />

          {missing.length > 0 ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              <span className="font-medium">
                {missing.length} field{missing.length === 1 ? "" : "s"} still to complete.
              </span>{" "}
              They appear as placeholders in the agreement: {missing.join(", ")}.
            </p>
          ) : (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              role="status"
            >
              <span className="font-medium">All fields complete.</span> The agreement is ready to
              download and sign.
            </p>
          )}

          <DocumentForm config={config} data={data} onChange={update} />
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-10">
          <NdaPreview markdown={markdown} />
        </div>
      </div>

      <footer className="no-print mt-10 border-t border-stone-200 pt-6 text-xs text-stone-500">
        Based on the Common Paper {config.title}, used under CC BY 4.0. Documents produced here are
        not legal advice — consult a qualified lawyer before relying on any generated agreement.
      </footer>
    </div>
  );
}
