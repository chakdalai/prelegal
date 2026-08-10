import { describe, expect, it } from "vitest";

import { createDefaultFormData, PARTY_FIELD_LABELS } from "./fields";
import { renderCoverPage, renderMnda } from "./render";
import { loadCoverPageTemplate, loadStandardTerms } from "./template";

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

  it("leaves the boilerplate of section 9 as published", async () => {
    const standardTerms = await loadStandardTerms();
    const document = renderMnda(
      {
        ...createDefaultFormData(),
        governingLaw: "Delaware",
        jurisdiction: "New Castle, DE",
      },
      standardTerms,
    );

    // The values belong on the Cover Page; the Standard Terms are incorporated
    // by reference and declared identical to the published text.
    expect(document).toContain("Governing Law: Delaware");
    expect(document).toContain("the laws of the State of **Governing Law**");
    expect(document).toContain("provisions of such **Governing Law**");
    expect(document).not.toContain("of such **Delaware**");
  });
});

/**
 * The Cover Page is generated rather than read from disk, so it cannot drift
 * silently the way the Standard Terms are prevented from doing. These tests
 * hold the generated version against the curated blank form: if a field is
 * renamed, added or removed upstream, they fail.
 */
describe("the curated Cover Page template", () => {
  it("defines no section the generated Cover Page is missing", async () => {
    const template = await loadCoverPageTemplate();
    const generated = renderCoverPage(createDefaultFormData());

    const headings = [...template.matchAll(/^### (.+)$/gm)].map(([, heading]) => heading);

    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(generated).toContain(`### ${heading}`);
    }
  });

  it("names the signature block rows the same way", async () => {
    const template = await loadCoverPageTemplate();
    const generated = renderCoverPage(createDefaultFormData());

    for (const label of Object.values(PARTY_FIELD_LABELS)) {
      expect(template).toContain(label);
      expect(generated).toContain(`| ${label} |`);
    }
  });

  it("keeps both parties and the rows left blank for signing", async () => {
    const template = await loadCoverPageTemplate();
    const generated = renderCoverPage(createDefaultFormData());

    for (const heading of ["PARTY 1", "PARTY 2", "Signature", "Date"]) {
      expect(template).toContain(heading);
      expect(generated).toContain(heading);
    }
  });
});
