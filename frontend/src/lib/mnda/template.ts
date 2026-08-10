import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-only access to the agreement templates curated in PL-2.
 *
 * The repository's `templates/` directory is the single source of truth for
 * agreement text, so the Standard Terms are read from it rather than copied
 * into this app. The page that consumes this is statically prerendered, which
 * means the read happens at build time and the text is baked into the output —
 * there is no filesystem dependency at runtime.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

/** Fixed boilerplate of the Mutual NDA, verbatim from the curated templates. */
export async function loadStandardTerms(): Promise<string> {
  return readFile(path.join(TEMPLATES_DIR, "mutual-nda.md"), "utf8");
}

/**
 * The blank Cover Page form.
 *
 * The app generates its own Cover Page rather than filling this one in, so
 * nothing in the running application reads this. It is loaded by the tests, to
 * catch the Cover Page's fields drifting from the curated template.
 */
export async function loadCoverPageTemplate(): Promise<string> {
  return readFile(path.join(TEMPLATES_DIR, "mutual-nda-coverpage.md"), "utf8");
}
