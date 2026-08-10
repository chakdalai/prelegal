import { describe, expect, it } from "vitest";

import { loadCatalog } from "./catalog";

describe("loadCatalog", () => {
  it("reads the repository's curated document catalog", async () => {
    const catalog = await loadCatalog();

    expect(catalog.length).toBe(12);
    for (const entry of catalog) {
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.filename).toMatch(/\.md$/);
      expect(entry.source).toMatch(/^https:\/\//);
    }
  });

  it("includes the Mutual NDA Cover Page that the builder implements", async () => {
    const catalog = await loadCatalog();

    expect(catalog.some((entry) => entry.filename === "mutual-nda-coverpage.md")).toBe(true);
  });
});
