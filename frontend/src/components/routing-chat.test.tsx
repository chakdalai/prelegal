import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogEntry } from "@/lib/catalog";

import { RoutingChat } from "./routing-chat";

const CATALOG: CatalogEntry[] = [
  {
    name: "Cloud Service Agreement",
    description: "Standard terms for a subscription cloud or SaaS product.",
    filename: "cloud-service-agreement.md",
    source: "https://example.com/csa",
  },
];

function renderChat() {
  return {
    user: userEvent.setup(),
    ...render(<RoutingChat catalog={CATALOG} />),
  };
}

describe("RoutingChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("greets the user before anything is sent", () => {
    renderChat();

    expect(screen.getByRole("list", { name: /chat transcript/i })).toHaveTextContent(
      /not sure which document/i,
    );
  });

  it("shows a link to the suggested document once one is returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          reply: "The Cloud Service Agreement is the closest fit.",
          suggestedFilename: "cloud-service-agreement.md",
        }),
      }),
    );
    const { user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "We're building a SaaS product.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    const link = await screen.findByRole("link", { name: /Cloud Service Agreement/ });
    expect(link.getAttribute("href")).toMatch(/^\/documents\/cloud-service-agreement\/?$/);
  });

  it("shows no link while nothing has been suggested yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "What kind of deal is this for?", suggestedFilename: null }),
      }),
    );
    const { user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Hi");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("What kind of deal is this for?");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
  });
});
