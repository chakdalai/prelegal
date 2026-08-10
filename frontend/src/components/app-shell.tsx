"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { clearSession, getSession } from "@/lib/auth/session";

/**
 * Chrome shared by every authenticated page: a slim top bar (logo, signed-in
 * email, sign out) plus the always-visible draft disclaimer banner.
 *
 * Each page keeps its own page-specific header below this (title,
 * Print/Download actions) — AppShell only owns global navigation and the
 * disclaimer, not per-page content, so wrapping a page in it doesn't require
 * restructuring that page's own header into props.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = getSession();

  const signOut = () => {
    clearSession();
    router.replace("/login/");
  };

  return (
    <div>
      <header className="no-print border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link className="text-lg font-semibold text-brand-navy" href="/dashboard/">
            Prelegal
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <span className="text-sm text-brand-gray">Signed in as {session.email}</span>
            ) : null}
            <button
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-1"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <p
        className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-center text-sm text-amber-900"
        role="note"
      >
        <strong className="font-semibold">Draft only.</strong> Documents generated here are
        AI-assisted drafts and have not been reviewed by a lawyer — have a qualified attorney
        review them before you sign or rely on them.
      </p>

      {children}
    </div>
  );
}
