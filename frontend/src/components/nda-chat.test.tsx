import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultFormData } from "@/lib/mnda/fields";

import { NdaChat } from "./nda-chat";

function renderChat(onFieldsUpdate = vi.fn()) {
  return {
    onFieldsUpdate,
    user: userEvent.setup(),
    ...render(<NdaChat data={createDefaultFormData()} onFieldsUpdate={onFieldsUpdate} />),
  };
}

describe("NdaChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("greets the user before anything is sent", () => {
    renderChat();

    expect(screen.getByRole("list", { name: /chat transcript/i })).toHaveTextContent(
      /tell me about the deal/i,
    );
  });

  it("sends the message, shows the reply, and applies only the fields the reply changed", async () => {
    const updatedFields = { ...createDefaultFormData(), governingLaw: "Delaware" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "Got it, Delaware it is.", fields: updatedFields }),
      }),
    );
    const { onFieldsUpdate, user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Governing law is Delaware.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Got it, Delaware it is.")).toBeInTheDocument();
    expect(screen.getByText("Governing law is Delaware.")).toBeInTheDocument();
    // A patch, not the full snapshot: applying the whole reply would clobber
    // any edit the user made to the form while the request was in flight.
    expect(onFieldsUpdate).toHaveBeenCalledWith({ governingLaw: "Delaware" });
  });

  it("keeps the message and shows an error when the request fails, without applying fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { onFieldsUpdate, user } = renderChat();

    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(onFieldsUpdate).not.toHaveBeenCalled();
  });

  it("does not send an empty message", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user } = renderChat();

    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
