import { describe, expect, it } from "vitest";

import { createDefaultFormData } from "./fields";
import { renderMnda } from "./render";
import { loadStandardTerms } from "./template";

/**
 * Guards the seam between this app and the curated templates: if
 * `templates/mutual-nda.md` gains a cross-reference the renderer does not know
 * about, or moves, this fails rather than shipping a document with markup in it.
 */
describe("the curated Mutual NDA template", () => {
  it("renders into an agreement with no unresolved markup", async () => {
    const standardTerms = await loadStandardTerms();
    const document = renderMnda(
      {
        ...createDefaultFormData(),
        effectiveDate: "2026-08-09",
        governingLaw: "Delaware",
        jurisdiction: "New Castle, DE",
      },
      standardTerms,
    );

    expect(document).not.toContain("coverpage_link");
    expect(document).not.toContain("<span");
    expect(document).not.toContain("<label");
  });

  it("keeps the whole agreement together", async () => {
    const document = renderMnda(createDefaultFormData(), await loadStandardTerms());

    // First and last sections of the Standard Terms, plus the required attribution.
    expect(document).toContain("**Introduction**");
    expect(document).toContain("**General**");
    expect(document).toContain("CC BY 4.0");
  });

  it("resolves the governing law and jurisdiction of section 9", async () => {
    const standardTerms = await loadStandardTerms();
    const document = renderMnda(
      {
        ...createDefaultFormData(),
        governingLaw: "Delaware",
        jurisdiction: "New Castle, DE",
      },
      standardTerms,
    );

    expect(document).toContain("the laws of the State of **Delaware**");
    expect(document).toContain("courts located in **New Castle, DE**");
    expect(document).not.toContain("such **Delaware**");
  });
});
