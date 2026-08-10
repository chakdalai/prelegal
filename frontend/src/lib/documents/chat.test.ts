import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmptyParty } from "@/lib/party";

import { fieldsPatchSince, sendChatTurn } from "./chat";
import { createDefaultFormData } from "./fields";
import { loadDocumentConfig } from "./registry";

describe("sendChatTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the per-document endpoint with the transcript and current fields", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    const fields = createDefaultFormData(config);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Got it.", fields }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendChatTurn(config.slug, [{ role: "user", content: "Hi" }], fields);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/cloud-service-agreement/chat",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ reply: "Got it.", fields });
  });

  it("throws when the response is not ok", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      sendChatTurn(config.slug, [], createDefaultFormData(config)),
    ).rejects.toThrow();
  });
});

describe("fieldsPatchSince", () => {
  it("is empty when nothing changed", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    const fields = createDefaultFormData(config);

    expect(fieldsPatchSince(fields, { ...fields })).toEqual({});
  });

  it("includes only the values that changed", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    const sent = createDefaultFormData(config);
    const received = { ...sent, values: { ...sent.values, governingLaw: "Delaware" } };

    expect(fieldsPatchSince(sent, received)).toEqual({ values: { governingLaw: "Delaware" } });
  });

  it("includes a party only when it actually changed, as the full party object", async () => {
    const config = (await loadDocumentConfig("cloud-service-agreement"))!;
    const sent = createDefaultFormData(config);
    const received = {
      ...sent,
      party1: { ...createEmptyParty(), company: "Acme, Inc." },
    };

    expect(fieldsPatchSince(sent, received)).toEqual({
      party1: { ...createEmptyParty(), company: "Acme, Inc." },
    });
  });
});
