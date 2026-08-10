import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearSession, setSession } from "@/lib/auth/session";

import { RequireSession } from "./require-session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("RequireSession", () => {
  afterEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  it("redirects to /login when there is no session", () => {
    render(
      <RequireSession>
        <p>secret</p>
      </RequireSession>,
    );

    expect(replace).toHaveBeenCalledWith("/login/");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders its children once a session exists", () => {
    setSession({ id: "1", email: "a@example.com" });

    render(
      <RequireSession>
        <p>secret</p>
      </RequireSession>,
    );

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("redirects if the session is cleared in another tab after mount", () => {
    setSession({ id: "1", email: "a@example.com" });

    render(
      <RequireSession>
        <p>secret</p>
      </RequireSession>,
    );
    expect(replace).not.toHaveBeenCalled();

    // Same-tab writes don't fire "storage", but this is the only way jsdom
    // lets a test simulate what another tab's sign-out would: a real
    // cross-tab clearSession() plus the "storage" event the browser fires
    // in every *other* tab sharing the origin.
    act(() => {
      clearSession();
      window.dispatchEvent(new Event("storage"));
    });

    expect(replace).toHaveBeenCalledWith("/login/");
  });
});
