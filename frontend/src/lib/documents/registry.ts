import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Server-only access to the generic document field configs curated in PL-6.
 *
 * `document-fields/` sits next to `templates/` and `catalog.json` at the repo
 * root, for the same reason: curated, static content read at build time
 * (the pages that consume this are statically prerendered) rather than
 * served from a backend endpoint. One JSON file per catalog document that
 * isn't the Mutual NDA — the Mutual NDA keeps its own hand-typed
 * `lib/mnda/fields.ts` rather than being folded into this generic shape; see
 * CLAUDE.md's AI chat design notes for why.
 */
const DOCUMENT_FIELDS_DIR = path.join(process.cwd(), "..", "document-fields");

export type FieldType = "text" | "textarea" | "date";

export interface FieldConfig {
  /** camelCase key, used as the property name in `DocumentFormData.values`. */
  name: string;
  label: string;
  type: FieldType;
  helpText?: string;
}

export interface DocumentConfig {
  /** Matches the route segment (`/documents/[slug]/`) and the config's own filename. */
  slug: string;
  /** The template file in `templates/`, read verbatim and rendered below the generated Cover Page. */
  filename: string;
  title: string;
  party1Label: string;
  party2Label: string;
  fields: FieldConfig[];
}

export async function loadDocumentConfigs(): Promise<DocumentConfig[]> {
  const files = (await readdir(DOCUMENT_FIELDS_DIR)).filter((file) => file.endsWith(".json"));

  const configs = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(DOCUMENT_FIELDS_DIR, file), "utf8");
      return JSON.parse(raw) as DocumentConfig;
    }),
  );

  return configs.sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadDocumentConfig(slug: string): Promise<DocumentConfig | undefined> {
  const configs = await loadDocumentConfigs();
  return configs.find((config) => config.slug === slug);
}
