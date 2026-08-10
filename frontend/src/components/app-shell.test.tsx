import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSession } from "@/lib/auth/session";

import { AppShell } from "./app-shell";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("AppShell", () => {
  afterEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  it("shows a signed-in user's email", () => {
    setSession({ id: "1", email: "a@example.com" });

    render(<AppShell>content</AppShell>);

    expect(screen.getByText(/Signed in as a@example.com/)).toBeInTheDocument();
  });

  it("signs out and redirects to /login", async () => {
    setSession({ id: "1", email: "a@example.com" });
    const user = userEvent.setup();

    render(<AppShell>content</AppShell>);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("shows the draft disclaimer", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("note")).toHaveTextContent("Draft only.");
    expect(screen.getByRole("note")).toHaveTextContent("not been reviewed by a lawyer");
  });

  it("renders its children", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
