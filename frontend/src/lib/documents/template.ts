import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-only access to the agreement templates curated in PL-2, for the
 * generic document builder (PL-6). As `lib/mnda/template.ts::loadStandardTerms`:
 * the repository's `templates/` directory is the single source of truth, read
 * at build time by the statically prerendered `/documents/[slug]/` page.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export async function loadStandardTerms(filename: string): Promise<string> {
  return readFile(path.join(TEMPLATES_DIR, filename), "utf8");
}
