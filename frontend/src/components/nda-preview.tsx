"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the completed agreement.
 *
 * GFM is enabled for the signature block, which is a Markdown table. Raw HTML
 * is deliberately not enabled: the renderer emits none, so allowing it would
 * only create a path for user input to reach the DOM as markup.
 */
export function NdaPreview({ markdown }: { markdown: string }) {
  return (
    <article className="legal-doc" aria-label="Agreement preview">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  );
}
