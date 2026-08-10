import { describe, expect, it } from "vitest";

import { createEmptyParty } from "@/lib/party";

import { createDefaultFormData, missingFieldLabels } from "./fields";
import { loadDocumentConfig } from "./registry";

describe("createDefaultFormData", () => {
  it("starts every configured field and both parties empty", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    const data = createDefaultFormData(config);

    for (const field of config.fields) {
      expect(data.values[field.name]).toBe("");
    }
    expect(data.party1).toEqual(createEmptyParty());
    expect(data.party2).toEqual(createEmptyParty());
  });
});

describe("missingFieldLabels", () => {
  it("lists every configured field and both parties' fields when empty", async () => {
    const config = (await loadDocumentConfig("pilot-agreement"))!;
    const missing = missingFieldLabels(config, createDefaultFormData(config));

    for (const field of config.fields) {
      expect(missing).toContain(field.label);
    }
    expect(missing).toContain(`${config.party1Label} Company`);
    expect(missing).toContain(`${config.party2Label} Company`);
  });

  it("drops a field once it's filled in", async () => {
    const config = (await loadDocumentConfig("pilot-agreement"))!;
    const data = createDefaultFormData(config);
    data.values.governingLaw = "Delaware";

    expect(missingFieldLabels(config, data)).not.toContain("Governing Law");
  });
});
