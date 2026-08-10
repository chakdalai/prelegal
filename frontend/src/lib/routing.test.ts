import { afterEach, describe, expect, it, vi } from "vitest";

import { sendRoutingTurn } from "./routing";

describe("sendRoutingTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the transcript and returns the reply and suggested filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Try the Cloud Service Agreement.", suggestedFilename: "cloud-service-agreement.md" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendRoutingTurn([{ role: "user", content: "I need a SaaS contract" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/route",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "I need a SaaS contract" }] }),
      }),
    );
    expect(result).toEqual({
      reply: "Try the Cloud Service Agreement.",
      suggestedFilename: "cloud-service-agreement.md",
    });
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(sendRoutingTurn([])).rejects.toThrow();
  });
});
