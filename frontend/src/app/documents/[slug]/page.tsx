import { notFound } from "next/navigation";

import { DocumentBuilder } from "@/components/document-builder";
import { RequireSession } from "@/components/require-session";
import { loadDocumentConfig, loadDocumentConfigs } from "@/lib/documents/registry";
import { loadStandardTerms } from "@/lib/documents/template";

/**
 * Field configs are fixed, curated content (`document-fields/`), so this page
 * is prerendered at build time per slug and the template is inlined into the
 * output, exactly like `/nda/`. `generateStaticParams` is required here
 * (unlike `/nda/`, which has no route param) because `output: "export"`
 * needs every dynamic route's params known at build time.
 */
export const dynamic = "force-static";

export async function generateStaticParams() {
  const configs = await loadDocumentConfigs();
  return configs.map((config) => ({ slug: config.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await loadDocumentConfig(slug);

  return {
    title: config ? `${config.title} creator — Prelegal` : "Document not found — Prelegal",
    description: config
      ? `Fill in a few key terms and download a completed Common Paper ${config.title}.`
      : undefined,
  };
}

export default async function DocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await loadDocumentConfig(slug);
  if (!config) notFound();

  const standardTerms = await loadStandardTerms(config.filename);

  return (
    <RequireSession>
      <main>
        <DocumentBuilder config={config} standardTerms={standardTerms} />
      </main>
    </RequireSession>
  );
}
