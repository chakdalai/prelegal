import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSession } from "@/lib/auth/session";
import type { CatalogEntry } from "@/lib/catalog";

import { Dashboard } from "./dashboard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const CATALOG: CatalogEntry[] = [
  {
    name: "Mutual Non-Disclosure Agreement — Cover Page",
    description: "Fill-in cover page for the Mutual NDA.",
    filename: "mutual-nda-coverpage.md",
    source: "https://example.com/mnda",
  },
  {
    name: "Mutual Non-Disclosure Agreement — Standard Terms",
    description: "Standard terms for a two-way confidentiality agreement.",
    filename: "mutual-nda.md",
    source: "https://example.com/mnda-terms",
  },
  {
    name: "AI Addendum",
    description: "Addendum layering AI-specific terms onto an existing agreement.",
    filename: "ai-addendum.md",
    source: "https://example.com/ai-addendum",
  },
];

describe("Dashboard", () => {
  afterEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  it("shows a signed-in user's email", () => {
    setSession({ id: "1", email: "a@example.com" });

    render(<Dashboard catalog={CATALOG} />);

    expect(screen.getByText(/Signed in as a@example.com/)).toBeInTheDocument();
  });

  it("links every document to its builder except the Standard Terms, which are inert", () => {
    render(<Dashboard catalog={CATALOG} />);

    const ndaLink = screen.getByRole("link", { name: /Mutual Non-Disclosure Agreement — Cover Page/ });
    expect(ndaLink.getAttribute("href")).toMatch(/^\/nda\/?$/);

    const aiAddendumLink = screen.getByRole("link", { name: /^AI Addendum/ });
    expect(aiAddendumLink.getAttribute("href")).toMatch(/^\/documents\/ai-addendum\/?$/);

    expect(screen.queryByRole("link", { name: /Standard Terms/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Included by reference")).toHaveLength(1);
  });

  it("signs out and redirects to /login", async () => {
    setSession({ id: "1", email: "a@example.com" });
    const user = userEvent.setup();

    render(<Dashboard catalog={CATALOG} />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(replace).toHaveBeenCalledWith("/login/");
  });
});
