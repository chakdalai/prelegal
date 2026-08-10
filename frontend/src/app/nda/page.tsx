import { AppShell } from "@/components/app-shell";
import { NdaBuilder } from "@/components/nda-builder";
import { RequireSession } from "@/components/require-session";
import { loadStandardTerms } from "@/lib/mnda/template";

/**
 * The Standard Terms are fixed text, so this page is prerendered at build time
 * and the template is inlined into the output. Everything after that — filling
 * in the form, previewing, downloading — happens in the browser.
 */
export const dynamic = "force-static";

export const metadata = {
  title: "Mutual NDA creator — Prelegal",
  description:
    "Fill in a few key terms and download a completed Common Paper Mutual Non-Disclosure Agreement.",
};

export default async function NdaPage() {
  const standardTerms = await loadStandardTerms();

  return (
    <RequireSession>
      <AppShell>
        <main>
          <NdaBuilder standardTerms={standardTerms} />
        </main>
      </AppShell>
    </RequireSession>
  );
}
