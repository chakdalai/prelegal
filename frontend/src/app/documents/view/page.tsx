import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { RequireSession } from "@/components/require-session";
import { SavedDocumentView } from "@/components/saved-document-view";

/**
 * The saved-document id is minted at runtime in the browser (see
 * lib/autosave.ts), so unlike `/documents/[slug]/` there is nothing to
 * enumerate via `generateStaticParams` at build time. This is a single
 * static page that reads `?id=` client-side instead.
 */
export const dynamic = "force-static";

export const metadata = {
  title: "Saved document — Prelegal",
};

export default function ViewSavedDocumentPage() {
  return (
    <RequireSession>
      <AppShell>
        <Suspense fallback={<p className="p-8 text-sm text-brand-gray">Loading…</p>}>
          <SavedDocumentView />
        </Suspense>
      </AppShell>
    </RequireSession>
  );
}
