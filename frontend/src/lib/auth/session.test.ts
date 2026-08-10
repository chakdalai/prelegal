import { afterEach, describe, expect, it } from "vitest";

import { clearSession, getSession, setSession } from "./session";

describe("session", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getSession()).toBeNull();
  });

  it("round-trips a session through localStorage", () => {
    setSession({ id: "1", email: "a@example.com" });

    expect(getSession()).toEqual({ id: "1", email: "a@example.com" });
  });

  it("clears the stored session", () => {
    setSession({ id: "1", email: "a@example.com" });
    clearSession();

    expect(getSession()).toBeNull();
  });

  it("treats malformed stored data as no session", () => {
    window.localStorage.setItem("prelegal:session", "not json");

    expect(getSession()).toBeNull();
  });
});
