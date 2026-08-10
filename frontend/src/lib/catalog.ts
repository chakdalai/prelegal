import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-only access to the repository's document catalog.
 *
 * catalog.json is curated, static content — the same kind of repository
 * source of truth as templates/ — so it is read at build time, exactly like
 * loadStandardTerms() in lib/mnda/template.ts, rather than served from a
 * new backend endpoint.
 */
const CATALOG_PATH = path.join(process.cwd(), "..", "catalog.json");

export interface CatalogEntry {
  name: string;
  description: string;
  filename: string;
  source: string;
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const raw = await readFile(CATALOG_PATH, "utf8");
  return JSON.parse(raw) as CatalogEntry[];
}
