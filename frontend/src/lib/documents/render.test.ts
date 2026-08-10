import { describe, expect, it } from "vitest";

import { createDefaultFormData, type DocumentFormData } from "./fields";
import { loadDocumentConfigs, type DocumentConfig } from "./registry";
import { loadStandardTerms } from "./template";
import {
  documentFilename,
  ensureAttribution,
  formatDate,
  renderCoverPage,
  renderDocument,
  resolveCrossReferences,
} from "./render";

function completedForm(config: DocumentConfig): DocumentFormData {
  const data = createDefaultFormData(config);
  for (const field of config.fields) {
    data.values[field.name] = field.type === "date" ? "2026-08-09" : `Test value for ${field.label}`;
  }
  data.party1 = {
    company: "Acme, Inc.",
    signatoryName: "Ada Lovelace",
    signatoryTitle: "CEO",
    noticeAddress: "1 Main St\nWilmington, DE 19801",
  };
  data.party2 = {
    company: "Globex Ltd",
    signatoryName: "Grace Hopper",
    signatoryTitle: "CTO",
    noticeAddress: "legal@globex.example",
  };
  return data;
}

describe("formatDate", () => {
  it("formats an ISO date without shifting across time zones", () => {
    expect(formatDate("2026-08-09")).toBe("August 9, 2026");
  });

  it("returns an empty string for incomplete or invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("2026-08")).toBe("");
  });
});

describe("resolveCrossReferences", () => {
  it("resolves every span class used across the templates", () => {
    const source = [
      '<span class="coverpage_link">Effective Date</span>',
      '<span class="orderform_link">Subscription Period</span>',
      '<span class="keyterms_link">Governing Law</span>',
      '<span class="businessterms_link">Territory</span>',
      '<span class="sow_link">Deliverables</span>',
    ].join(" ");

    const resolved = resolveCrossReferences(source);

    expect(resolved).toContain("**Effective Date**");
    expect(resolved).toContain("**Subscription Period**");
    expect(resolved).toContain("**Governing Law**");
    expect(resolved).toContain("**Territory**");
    expect(resolved).toContain("**Deliverables**");
    expect(resolved).not.toContain("<span");
    expect(resolved).not.toContain("_link");
  });
});

describe("ensureAttribution", () => {
  const config = { title: "Test Agreement" } as DocumentConfig;

  it("appends a CC BY 4.0 notice when the template doesn't carry one", () => {
    const result = ensureAttribution(config, "Some boilerplate text.");
    expect(result).toContain("CC BY 4.0");
    expect(result).toContain("Some boilerplate text.");
  });

  it("does not duplicate an attribution the template already carries", () => {
    const source = "Boilerplate free to use under CC BY 4.0.";
    expect(ensureAttribution(config, source)).toBe(source);
  });
});

describe("escaping what the user types", () => {
  it("stops a heading or rule typed into a field from restructuring the agreement", async () => {
    const configs = await loadDocumentConfigs();
    const config = configs.find((c) => c.slug === "cloud-service-agreement")!;
    const data = completedForm(config);
    data.values.technicalSupport = "Business hours.\n\n# Termination\n\n---\n- one";

    const markdown = renderCoverPage(config, data);

    expect(markdown).toContain("\\# Termination");
    expect(markdown).toContain("\\---");
    expect(markdown).toContain("\\- one");
  });

  it("stops emphasis in a company name running on into the clauses that follow", async () => {
    const configs = await loadDocumentConfigs();
    const config = configs.find((c) => c.slug === "cloud-service-agreement")!;
    const data = completedForm(config);
    data.party1.company = "Acme **Holdings";

    expect(renderCoverPage(config, data)).toContain("Acme \\*\\*Holdings");
  });

  it("marks unanswered fields with bracketed placeholders", async () => {
    const configs = await loadDocumentConfigs();
    const config = configs.find((c) => c.slug === "cloud-service-agreement")!;
    const markdown = renderCoverPage(config, createDefaultFormData(config));

    expect(markdown).toContain("[Governing Law]");
    expect(markdown).toContain("| Company | [Company] | [Company] |");
  });
});

describe("documentFilename", () => {
  it("names the file after the document and both parties", async () => {
    const configs = await loadDocumentConfigs();
    const config = configs.find((c) => c.slug === "cloud-service-agreement")!;

    expect(documentFilename(config, completedForm(config))).toBe(
      "cloud-service-agreement-acme-inc-and-globex-ltd.md",
    );
  });

  it("falls back to a generic name before the parties are known", async () => {
    const configs = await loadDocumentConfigs();
    const config = configs.find((c) => c.slug === "cloud-service-agreement")!;

    expect(documentFilename(config, createDefaultFormData(config))).toBe(
      "cloud-service-agreement.md",
    );
  });
});

/**
 * Guards the seam between this app and the curated templates: every
 * `document-fields/*.json` config must pair with a real template, and
 * rendering it must leave no unresolved markup and carry the required CC BY
 * 4.0 attribution — none of these ten templates carry one inline, unlike
 * `templates/mutual-nda.md` (see `ensureAttribution`).
 */
describe.each(await loadDocumentConfigs())("the curated $slug template", (config) => {
  it("renders into an agreement with no unresolved cross-reference markup and the required attribution", async () => {
    const standardTerms = await loadStandardTerms(config.filename);
    const document = renderDocument(config, completedForm(config), standardTerms);

    // `_link` classes (coverpage_link, orderform_link, ...) must all resolve
    // to bold defined-term references. Bare `<span id="...">` anchors for
    // internal section links are a separate, harmless concern — react-markdown
    // renders no raw HTML, so they never reach the page — and are left alone.
    expect(document).not.toContain("_link");
    expect(document).toContain("CC BY 4.0");
    expect(document).toContain(`# ${config.title}`);
  });

  it("fills in every configured field with the deal-specific value", async () => {
    const standardTerms = await loadStandardTerms(config.filename);
    const data = completedForm(config);
    const document = renderDocument(config, data, standardTerms);

    for (const field of config.fields) {
      if (field.type !== "date") {
        expect(document).toContain(`Test value for ${field.label}`);
      }
    }
  });

  it("marks every configured field as a bracketed placeholder when unanswered", async () => {
    const standardTerms = await loadStandardTerms(config.filename);
    const document = renderDocument(config, createDefaultFormData(config), standardTerms);

    for (const field of config.fields) {
      expect(document).toContain(`[${field.label}]`);
    }
  });
});
