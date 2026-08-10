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

  it("has no password field", () => {
    render(<LoginForm />);

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("signs in against /api/auth/login by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", email: "a@example.com" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ body: JSON.stringify({ email: "a@example.com" }) }),
    );
  });

  it("signs up against /api/auth/signup once switched to sign-up mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", email: "a@example.com" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
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
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(getSession()).toEqual({ id: "1", email: "a@example.com" });
    expect(replace).toHaveBeenCalledWith("/dashboard/");
  });

  it("offers to switch to sign-up when signing in to an unknown email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try signing up instead/i);
    expect(replace).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
  });

  it("offers to switch to sign-in when signing up with an existing email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try signing in instead/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a generic error and does not redirect on an unexpected failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
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
