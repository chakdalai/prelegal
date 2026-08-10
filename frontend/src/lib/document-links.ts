import type { CatalogEntry } from "@/lib/catalog";

/**
 * Where a catalog entry's builder lives, or `null` if it isn't a standalone
 * starting point.
 *
 * The Mutual NDA Cover Page keeps its own dedicated route and builder
 * (`/nda/`, `NdaBuilder`) rather than the generic one added in PL-6 — see
 * CLAUDE.md's AI chat design notes for why. Its Standard Terms entry is
 * boilerplate incorporated by reference into the Cover Page, not something a
 * user starts on its own, so it has no href at all. Every other catalog
 * document uses the generic `/documents/[slug]/` route, where `slug` is the
 * filename without its `.md` extension — the same convention each
 * `document-fields/*.json` config's own `slug` follows.
 */
export function hrefForCatalogEntry(entry: CatalogEntry): string | null {
  if (entry.filename === "mutual-nda-coverpage.md") return "/nda/";
  if (entry.filename === "mutual-nda.md") return null;

  return `/documents/${entry.filename.replace(/\.md$/, "")}/`;
}
