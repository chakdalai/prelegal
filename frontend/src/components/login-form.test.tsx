import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSession, setSession } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("LoginForm", () => {
  afterEach(() => {
    window.localStorage.clear();
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it("sends only the email, never the password, to the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", email: "a@example.com" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever-this-is-fake");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ body: JSON.stringify({ email: "a@example.com" }) }),
    );
  });

  it("stores the session and redirects to the dashboard on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "1", email: "a@example.com" }) }),
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "anything");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(getSession()).toEqual({ id: "1", email: "a@example.com" });
    expect(replace).toHaveBeenCalledWith("/dashboard/");
  });

  it("shows an error and does not redirect when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "anything");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(replace).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
  });

  it("redirects immediately if a session already exists", () => {
    setSession({ id: "1", email: "a@example.com" });

    render(<LoginForm />);

    expect(replace).toHaveBeenCalledWith("/dashboard/");
  });
});
