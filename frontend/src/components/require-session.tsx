"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { getSession, hasSession } from "@/lib/auth/session";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getServerSnapshot() {
  return false;
}

/**
 * Gates its children behind a client-side session check, redirecting to
 * /login when there isn't one. The static export can't check this on the
 * server, so every gated page renders a brief loading state until the
 * check runs in the browser.
 *
 * Rendering uses useSyncExternalStore (hydration-safe: it renders
 * getServerSnapshot's `false` on the first client pass, matching the
 * static export, then corrects itself). The mount-time redirect below
 * deliberately does NOT key off that same value — that first, still-`false`
 * pass is also when this effect's mount-time run fires, and redirecting off
 * it would send an already-signed-in user to /login before the correction
 * ever lands. Reading the session directly here is a real-time check with
 * no such transitional state.
 *
 * A second effect handles the case the mount-time check can't: a session
 * that existed after mount disappearing later (e.g. signed out in another
 * tab, via the `storage` listener above). It only acts once `authenticated`
 * has been true at least once, so it never fires on that same transitional
 * first pass.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authenticated = useSyncExternalStore(subscribe, hasSession, getServerSnapshot);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login/");
    }
  }, [router]);

  useEffect(() => {
    if (authenticated) {
      wasAuthenticated.current = true;
    } else if (wasAuthenticated.current) {
      router.replace("/login/");
    }
  }, [authenticated, router]);

  if (!authenticated) {
    return <p className="p-8 text-sm text-brand-gray">Loading…</p>;
  }

  return <>{children}</>;
}
