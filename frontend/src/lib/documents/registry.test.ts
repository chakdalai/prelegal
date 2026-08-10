import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadCatalog } from "@/lib/catalog";

import { loadDocumentConfig, loadDocumentConfigs } from "./registry";

const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

describe("loadDocumentConfigs", () => {
  it("loads a config for every non-Mutual-NDA catalog document", async () => {
    const catalog = await loadCatalog();
    const configs = await loadDocumentConfigs();

    const nonNdaFilenames = catalog
      .map((entry) => entry.filename)
      .filter((filename) => filename !== "mutual-nda-coverpage.md" && filename !== "mutual-nda.md");

    expect(configs.map((config) => config.filename).sort()).toEqual(nonNdaFilenames.sort());
  });

  it("gives every config a slug matching its filename, and no duplicate field names", async () => {
    const configs = await loadDocumentConfigs();

    for (const config of configs) {
      expect(config.filename).toBe(`${config.slug}.md`);

      const names = config.fields.map((field) => field.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("points every config at a template that actually exists", async () => {
    const configs = await loadDocumentConfigs();

    for (const config of configs) {
      await expect(readFile(path.join(TEMPLATES_DIR, config.filename), "utf8")).resolves.toContain(
        "#",
      );
    }
  });
});

describe("loadDocumentConfig", () => {
  it("finds a config by slug", async () => {
    const config = await loadDocumentConfig("cloud-service-agreement");
    expect(config?.title).toBe("Cloud Service Agreement");
  });

  it("returns undefined for an unknown slug", async () => {
    expect(await loadDocumentConfig("not-a-real-document")).toBeUndefined();
  });
});
