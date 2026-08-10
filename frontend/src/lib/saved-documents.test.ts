import { afterEach, describe, expect, it, vi } from "vitest";

import { formatSavedDocumentTimestamp, getDocument, listDocuments, saveDocument } from "./saved-documents";

describe("formatSavedDocumentTimestamp", () => {
  it("parses the stored timestamp as UTC rather than the local time zone", () => {
    // Not a hardcoded string: the assertion itself must not depend on which
    // time zone the test happens to run in, only on the appended "Z"
    // actually forcing UTC parsing rather than local-time parsing.
    const expected = new Date("2026-08-10T09:30:00Z").toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(formatSavedDocumentTimestamp("2026-08-10 09:30:00")).toBe(expected);
  });

  it("returns the input unchanged if it isn't a parseable date", () => {
    expect(formatSavedDocumentTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("saveDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs to the document's id and returns the saved detail", async () => {
    const detail = {
      id: "doc-1",
      slug: "mutual-nda",
      title: "Mutual NDA",
      formData: { purpose: "Testing" },
      markdown: "# Mutual NDA",
      createdAt: "2026-08-10T00:00:00",
      updatedAt: "2026-08-10T00:00:00",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => detail });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveDocument({
      id: "doc-1",
      userId: "user-1",
      slug: "mutual-nda",
      title: "Mutual NDA",
      formData: { purpose: "Testing" },
      markdown: "# Mutual NDA",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/saved-documents/doc-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          userId: "user-1",
          slug: "mutual-nda",
          title: "Mutual NDA",
          formData: { purpose: "Testing" },
          markdown: "# Mutual NDA",
        }),
      }),
    );
    expect(result).toEqual(detail);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      saveDocument({
        id: "doc-1",
        userId: "user-1",
        slug: "mutual-nda",
        title: "Mutual NDA",
        formData: {},
        markdown: "",
      }),
    ).rejects.toThrow();
  });
});

describe("listDocuments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches documents scoped to the user id", async () => {
    const summaries = [{ id: "doc-1", slug: "mutual-nda", title: "Mutual NDA", createdAt: "", updatedAt: "" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => summaries });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listDocuments("user-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-documents?userId=user-1");
    expect(result).toEqual(summaries);
  });
});

describe("getDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the document is not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await getDocument("doc-1", "user-1");

    expect(result).toBeNull();
  });

  it("returns the parsed detail on success", async () => {
    const detail = {
      id: "doc-1",
      slug: "mutual-nda",
      title: "Mutual NDA",
      formData: {},
      markdown: "# Mutual NDA",
      createdAt: "",
      updatedAt: "",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => detail }));

    const result = await getDocument("doc-1", "user-1");

    expect(result).toEqual(detail);
  });

  it("throws on an unexpected error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getDocument("doc-1", "user-1")).rejects.toThrow();
  });
});
