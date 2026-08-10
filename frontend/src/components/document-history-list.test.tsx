import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSession } from "@/lib/auth/session";

import { DocumentHistoryList } from "./document-history-list";

describe("DocumentHistoryList", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders nothing while there is no session", () => {
    const { container } = render(<DocumentHistoryList />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the user has no saved documents", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    const { container } = render(<DocumentHistoryList />);

    await waitFor(() => expect(container.querySelector("section")).not.toBeInTheDocument());
  });

  it("lists saved documents, each linking to its read-only view", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "doc-1",
            slug: "mutual-nda",
            title: "Mutual NDA — Acme, Inc.",
            createdAt: "2026-08-01 12:00:00",
            updatedAt: "2026-08-01 12:00:00",
          },
        ],
      }),
    );

    render(<DocumentHistoryList />);

    const link = await screen.findByRole("link", { name: /Mutual NDA — Acme, Inc\./ });
    expect(link.getAttribute("href")).toMatch(/^\/documents\/view\/?\?id=doc-1$/);
  });
});
