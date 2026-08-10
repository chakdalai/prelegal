import { describe, expect, it } from "vitest";

import { ensureDraftDisclaimer } from "./disclaimer";

describe("ensureDraftDisclaimer", () => {
  it("prepends the draft notice", () => {
    const result = ensureDraftDisclaimer("# Agreement\n\nBody text.");

    expect(result).toContain("Draft document");
    expect(result).toContain("has not been reviewed by a lawyer");
    expect(result.indexOf("Draft document")).toBeLessThan(result.indexOf("# Agreement"));
  });

  it("does not duplicate the notice if the text already carries one", () => {
    const once = ensureDraftDisclaimer("# Agreement");
    const twice = ensureDraftDisclaimer(once);

    expect(twice).toBe(once);
    expect(twice.match(/has not been reviewed by a lawyer/gi)).toHaveLength(1);
  });
});
