import { describe, expect, it } from "vitest";

import { createDefaultFormData, type MndaFormData } from "./fields";
import {
  documentFilename,
  fillStandardTerms,
  formatEffectiveDate,
  renderCoverPage,
  renderMnda,
} from "./render";

function completedForm(overrides: Partial<MndaFormData> = {}): MndaFormData {
  return {
    ...createDefaultFormData(),
    effectiveDate: "2026-08-09",
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    party1: {
      company: "Acme, Inc.",
      signatoryName: "Ada Lovelace",
      signatoryTitle: "CEO",
      noticeAddress: "1 Main St\nWilmington, DE 19801",
    },
    party2: {
      company: "Globex Ltd",
      signatoryName: "Grace Hopper",
      signatoryTitle: "CTO",
      noticeAddress: "legal@globex.example",
    },
    ...overrides,
  };
}

describe("formatEffectiveDate", () => {
  it("formats an ISO date without shifting across time zones", () => {
    expect(formatEffectiveDate("2026-08-09")).toBe("August 9, 2026");
    expect(formatEffectiveDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatEffectiveDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("returns an empty string for incomplete or invalid input", () => {
    expect(formatEffectiveDate("")).toBe("");
    expect(formatEffectiveDate("2026-08")).toBe("");
    expect(formatEffectiveDate("2026-13-09")).toBe("");
  });
});

describe("renderCoverPage", () => {
  it("fills in the deal-specific terms", () => {
    const markdown = renderCoverPage(completedForm());

    expect(markdown).toContain("August 9, 2026");
    expect(markdown).toContain("Governing Law: Delaware");
    expect(markdown).toContain("Jurisdiction: New Castle, DE");
    expect(markdown).toContain("Expires 1 year from the Effective Date.");
    expect(markdown).toContain("| Company | Acme, Inc. | Globex Ltd |");
  });

  it("marks unanswered fields with bracketed placeholders", () => {
    const markdown = renderCoverPage(createDefaultFormData());

    expect(markdown).toContain("[Effective Date]");
    expect(markdown).toContain("Governing Law: [Governing Law]");
    expect(markdown).toContain("| Company | [Company] | [Company] |");
  });

  it("flattens a multi-line notice address so it stays inside its table cell", () => {
    const markdown = renderCoverPage(completedForm());
    const row = markdown
      .split("\n")
      .find((line) => line.startsWith("| Notice Address"));

    expect(row).toBe(
      "| Notice Address | 1 Main St, Wilmington, DE 19801 | legal@globex.example |",
    );
  });

  it("escapes pipes that would otherwise split a table cell", () => {
    const markdown = renderCoverPage(
      completedForm({
        party1: { ...completedForm().party1, company: "Acme | Holdings" },
      }),
    );

    expect(markdown).toContain("| Acme \\| Holdings |");
  });

  it("renders both term options", () => {
    expect(
      renderCoverPage(completedForm({ mndaTerm: { kind: "untilTerminated" } })),
    ).toContain("Continues until terminated");

    expect(
      renderCoverPage(completedForm({ confidentialityTerm: { kind: "perpetual" } })),
    ).toContain("In perpetuity.");

    expect(
      renderCoverPage(completedForm({ mndaTerm: { kind: "expires", years: 2 } })),
    ).toContain("Expires 2 years from the Effective Date.");
  });

  it("records that there are no modifications by default", () => {
    expect(renderCoverPage(completedForm())).toContain("None.");
  });
});

describe("fillStandardTerms", () => {
  const STANDARD_TERMS = [
    'commences on the <span class="coverpage_link">Effective Date</span>',
    'used solely for the <span class="coverpage_link">Purpose</span>',
    'the laws of the State of <span class="coverpage_link">Governing Law</span>, without',
    'regard to the conflict of laws provisions of such <span class="coverpage_link">Governing Law</span>.',
    'courts located in <span class="coverpage_link">Jurisdiction</span>, and submits to',
    'the exclusive jurisdiction of such <span class="coverpage_link">Jurisdiction</span>.',
  ].join(" ");

  it("substitutes values that read naturally inline", () => {
    const filled = fillStandardTerms(STANDARD_TERMS, completedForm());

    expect(filled).toContain("the laws of the State of **Delaware**");
    expect(filled).toContain("courts located in **New Castle, DE**");
  });

  it("keeps the defined term for repeat references, which read wrongly as values", () => {
    const filled = fillStandardTerms(STANDARD_TERMS, completedForm());

    expect(filled).toContain("provisions of such **Governing Law**");
    expect(filled).toContain("exclusive jurisdiction of such **Jurisdiction**");
    expect(filled).not.toContain("such **Delaware**");
  });

  it("leaves cover-page defined terms as terms", () => {
    const filled = fillStandardTerms(STANDARD_TERMS, completedForm());

    expect(filled).toContain("solely for the **Purpose**");
    // A date here would read "commences on the August 9, 2026".
    expect(filled).toContain("commences on the **Effective Date**");
  });

  it("resolves every cross-reference, leaving no markup behind", () => {
    const filled = fillStandardTerms(STANDARD_TERMS, completedForm());

    expect(filled).not.toContain("coverpage_link");
    expect(filled).not.toContain("<span");
  });

  it("falls back to the field name when a value is missing", () => {
    const filled = fillStandardTerms(STANDARD_TERMS, createDefaultFormData());

    expect(filled).toContain("the laws of the State of **Governing Law**");
  });
});

describe("renderMnda", () => {
  it("joins the cover page to the standard terms", () => {
    const document = renderMnda(completedForm(), "# Standard Terms\n\n1. **Introduction**.\n");

    expect(document).toContain("# Mutual Non-Disclosure Agreement");
    expect(document).toContain("\n---\n");
    expect(document).toContain("# Standard Terms");
    expect(document.indexOf("# Mutual Non-Disclosure Agreement")).toBeLessThan(
      document.indexOf("# Standard Terms"),
    );
  });
});

describe("documentFilename", () => {
  it("names the file after both parties", () => {
    expect(documentFilename(completedForm())).toBe("mutual-nda-acme-inc-and-globex-ltd.md");
  });

  it("falls back to a generic name before the parties are known", () => {
    expect(documentFilename(createDefaultFormData())).toBe("mutual-nda.md");
  });
});
