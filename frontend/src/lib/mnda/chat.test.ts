import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultFormData, createEmptyParty } from "./fields";
import { fieldsPatchSince, sendChatTurn } from "./chat";

describe("sendChatTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the transcript and current fields, and returns the parsed reply", async () => {
    const fields = createDefaultFormData();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Got it.", fields }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendChatTurn([{ role: "user", content: "Hi" }], fields);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mnda/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }], fields }),
      }),
    );
    expect(result).toEqual({ reply: "Got it.", fields });
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(sendChatTurn([], createDefaultFormData())).rejects.toThrow();
  });
});

describe("fieldsPatchSince", () => {
  it("is empty when nothing changed", () => {
    const fields = createDefaultFormData();

    expect(fieldsPatchSince(fields, { ...fields })).toEqual({});
  });

  it("includes only the scalar fields that changed", () => {
    const sent = createDefaultFormData();
    const received = { ...sent, governingLaw: "Delaware" };

    expect(fieldsPatchSince(sent, received)).toEqual({ governingLaw: "Delaware" });
  });

  it("includes a term only when it actually changed", () => {
    const sent = createDefaultFormData();
    const received = { ...sent, mndaTerm: { kind: "untilTerminated" as const } };

    expect(fieldsPatchSince(sent, received)).toEqual({
      mndaTerm: { kind: "untilTerminated" },
    });
  });

  it("includes a party only when it actually changed, as the full party object", () => {
    const sent = createDefaultFormData();
    const received = {
      ...sent,
      party1: { ...createEmptyParty(), company: "Acme, Inc." },
    };

    expect(fieldsPatchSince(sent, received)).toEqual({
      party1: { ...createEmptyParty(), company: "Acme, Inc." },
    });
  });
});
