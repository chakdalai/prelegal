import { describe, expect, it } from "vitest";

import { loadCatalog } from "@/lib/catalog";

import { hrefForCatalogEntry } from "./document-links";

describe("hrefForCatalogEntry", () => {
  it("routes the Mutual NDA Cover Page to its dedicated builder", () => {
    expect(
      hrefForCatalogEntry({
        name: "Mutual Non-Disclosure Agreement — Cover Page",
        description: "",
        filename: "mutual-nda-coverpage.md",
        source: "",
      }),
    ).toBe("/nda/");
  });

  it("gives the Mutual NDA Standard Terms no href — it's incorporated by reference, not a starting point", () => {
    expect(
      hrefForCatalogEntry({
        name: "Mutual Non-Disclosure Agreement — Standard Terms",
        description: "",
        filename: "mutual-nda.md",
        source: "",
      }),
    ).toBeNull();
  });

  it("routes every other catalog document to the generic builder by slug", () => {
    expect(
      hrefForCatalogEntry({
        name: "Cloud Service Agreement",
        description: "",
        filename: "cloud-service-agreement.md",
        source: "",
      }),
    ).toBe("/documents/cloud-service-agreement/");
  });

  it("gives every non-Mutual-NDA catalog document a working href", async () => {
    const catalog = await loadCatalog();

    for (const entry of catalog) {
      if (entry.filename === "mutual-nda.md") continue;
      expect(hrefForCatalogEntry(entry)).not.toBeNull();
    }
  });
});
