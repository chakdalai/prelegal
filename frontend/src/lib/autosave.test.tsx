import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, setSession } from "@/lib/auth/session";

import { useAutosave } from "./autosave";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderAutosave(data: object, markdown = "markdown") {
  return renderHook(({ data: hookData, markdown: hookMarkdown }) => useAutosave({
    slug: "mutual-nda",
    title: "Mutual NDA",
    data: hookData,
    markdown: hookMarkdown,
  }), { initialProps: { data, markdown } });
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
    window.localStorage.clear();
  });

  it("does nothing while there is no session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderAutosave({ purpose: "" });
    rerender({ data: { purpose: "Evaluating a deal" }, markdown: "markdown" });
    await advance(5000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not save while the data is still the mount-time default", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderAutosave({ purpose: "" });
    await advance(5000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves once the data changes, after debouncing", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "generated-id",
        slug: "mutual-nda",
        title: "Mutual NDA",
        formData: {},
        markdown: "markdown",
        createdAt: "",
        updatedAt: "",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender, result } = renderAutosave({ purpose: "" });
    rerender({ data: { purpose: "Evaluating a deal" }, markdown: "markdown" });
    await advance(1500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^\/api\/saved-documents\//);
    expect(JSON.parse(init.body)).toMatchObject({
      userId: "user-1",
      slug: "mutual-nda",
      title: "Mutual NDA",
      formData: { purpose: "Evaluating a deal" },
    });
    expect(result.current).toBe("saved");
  });

  it("debounces rapid changes into a single save", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "generated-id",
        slug: "mutual-nda",
        title: "Mutual NDA",
        formData: {},
        markdown: "markdown",
        createdAt: "",
        updatedAt: "",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderAutosave({ purpose: "" });
    rerender({ data: { purpose: "E" }, markdown: "markdown" });
    await advance(500);
    rerender({ data: { purpose: "Ev" }, markdown: "markdown" });
    await advance(500);
    rerender({ data: { purpose: "Eva" }, markdown: "markdown" });
    await advance(1500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the same document id across subsequent saves", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "generated-id",
        slug: "mutual-nda",
        title: "Mutual NDA",
        formData: {},
        markdown: "markdown",
        createdAt: "",
        updatedAt: "",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderAutosave({ purpose: "" });
    rerender({ data: { purpose: "First" }, markdown: "markdown" });
    await advance(1500);
    rerender({ data: { purpose: "Second" }, markdown: "markdown" });
    await advance(1500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0];
    const secondUrl = fetchMock.mock.calls[1][0];
    expect(secondUrl).toBe(firstUrl);
  });

  it("sets an error status when the save fails", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { rerender, result } = renderAutosave({ purpose: "" });
    rerender({ data: { purpose: "Evaluating a deal" }, markdown: "markdown" });
    await advance(1500);

    expect(result.current).toBe("error");
  });
});
