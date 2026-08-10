import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSession } from "@/lib/auth/session";
import { stubObjectUrls } from "@/test-support/object-urls";

import { SavedDocumentView } from "./saved-document-view";

let searchParams = new URLSearchParams("id=doc-1");
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

const DOC = {
  id: "doc-1",
  slug: "mutual-nda",
  title: "Mutual NDA — Acme, Inc.",
  formData: {},
  markdown: "# Mutual Non-Disclosure Agreement\n\nBody.",
  createdAt: "2026-08-01 12:00:00",
  updatedAt: "2026-08-02 09:30:00",
};

describe("SavedDocumentView", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    searchParams = new URLSearchParams("id=doc-1");
  });

  it("shows a not-found message when there is no id", async () => {
    searchParams = new URLSearchParams();
    setSession({ id: "user-1", email: "a@example.com" });

    render(<SavedDocumentView />);

    expect(await screen.findByText(/couldn.t be found/)).toBeInTheDocument();
  });

  it("shows a not-found message when the document does not exist", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    render(<SavedDocumentView />);

    expect(await screen.findByText(/couldn.t be found/)).toBeInTheDocument();
  });

  it("renders the saved document's markdown read-only, with no form or chat", async () => {
    setSession({ id: "user-1", email: "a@example.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DOC }));

    render(<SavedDocumentView />);

    expect(await screen.findByRole("heading", { name: "Mutual NDA — Acme, Inc." })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /agreement preview/i })).toHaveTextContent(
      "Mutual Non-Disclosure Agreement",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  describe("actions", () => {
    it("downloads the saved markdown", async () => {
      setSession({ id: "user-1", email: "a@example.com" });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DOC }));
      const blobs = stubObjectUrls().created;
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const user = userEvent.setup();

      render(<SavedDocumentView />);
      await user.click(await screen.findByRole("button", { name: /download markdown/i }));

      const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe("mutual-nda-acme-inc.md");
      expect(blobs[0].type).toBe("text/markdown");
    });

    it("opens the browser's print dialog", async () => {
      setSession({ id: "user-1", email: "a@example.com" });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DOC }));
      const print = vi.fn();
      vi.stubGlobal("print", print);
      const user = userEvent.setup();

      render(<SavedDocumentView />);
      await user.click(await screen.findByRole("button", { name: /print \/ save as pdf/i }));

      expect(print).toHaveBeenCalledOnce();
    });
  });
});
