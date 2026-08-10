import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultFormData } from "@/lib/documents/fields";
import type { DocumentConfig } from "@/lib/documents/registry";

import { DocumentChat } from "./document-chat";

const CONFIG: DocumentConfig = {
  slug: "test-agreement",
  filename: "test-agreement.md",
  title: "Test Agreement",
  party1Label: "Provider",
  party2Label: "Customer",
  fields: [{ name: "fees", label: "Fees", type: "text" }],
};

function renderChat(onFieldsUpdate = vi.fn()) {
  return {
    onFieldsUpdate,
    user: userEvent.setup(),
    ...render(
      <DocumentChat
        config={CONFIG}
        data={createDefaultFormData(CONFIG)}
        onFieldsUpdate={onFieldsUpdate}
      />,
    ),
  };
}

describe("DocumentChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("greets the user by the document's own title", () => {
    renderChat();

    expect(screen.getByRole("list", { name: /chat transcript/i })).toHaveTextContent(
      /test agreement cover page/i,
    );
  });

  it("posts to the document's own chat endpoint and applies only the changed fields", async () => {
    const updatedFields = { ...createDefaultFormData(CONFIG), values: { fees: "$1,000/month" } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Got it, $1,000/month.", fields: updatedFields }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onFieldsUpdate, user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Fees are $1,000/month.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Got it, $1,000/month.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/test-agreement/chat",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onFieldsUpdate).toHaveBeenCalledWith({ values: { fees: "$1,000/month" } });
  });

  it("keeps the message and shows an error when the request fails, without applying fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { onFieldsUpdate, user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(onFieldsUpdate).not.toHaveBeenCalled();
  });

  it("returns focus to the message input after a reply arrives", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "Got it.", fields: createDefaultFormData(CONFIG) }),
      }),
    );
    const { user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText("Got it.");

    expect(screen.getByLabelText("Message")).toHaveFocus();
  });
});
