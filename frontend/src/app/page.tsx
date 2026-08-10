import { NdaBuilder } from "@/components/nda-builder";
import { loadStandardTerms } from "@/lib/mnda/template";

/**
 * The Standard Terms are fixed text, so this page is prerendered at build time
 * and the template is inlined into the output. Everything after that — filling
 * in the form, previewing, downloading — happens in the browser.
 */
export const dynamic = "force-static";

export default async function Home() {
  const standardTerms = await loadStandardTerms();

  return (
    <main>
      <NdaBuilder standardTerms={standardTerms} />
    </main>
  );
}
