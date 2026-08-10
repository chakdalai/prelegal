"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CatalogEntry } from "@/lib/catalog";
import { clearSession, getSession } from "@/lib/auth/session";
import { hrefForCatalogEntry } from "@/lib/document-links";
import { RoutingChat } from "@/components/routing-chat";

export function Dashboard({ catalog }: { catalog: CatalogEntry[] }) {
  const router = useRouter();
  const session = getSession();

  const signOut = () => {
    clearSession();
    router.replace("/login/");
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Prelegal</h1>
          <p className="mt-1 text-sm text-brand-gray">
            Choose a document to draft.
            {session ? ` Signed in as ${session.email}.` : ""}
          </p>
        </div>
        <button
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-1"
          onClick={signOut}
          type="button"
        >
          Sign out
        </button>
      </header>

      <RoutingChat catalog={catalog} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((entry) => {
          const href = hrefForCatalogEntry(entry);

          const card = (
            <div
              className={`h-full rounded-lg border bg-white p-5 transition ${
                href
                  ? "border-2 border-brand-blue shadow-sm group-hover:shadow-md"
                  : "border-stone-200"
              }`}
            >
              <h2 className="font-medium text-brand-navy">{entry.name}</h2>
              <p className="mt-2 text-sm text-stone-600">{entry.description}</p>
              {href ? (
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
                  Start drafting <span aria-hidden="true">&rarr;</span>
                </span>
              ) : (
                <span className="mt-4 inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-brand-gray">
                  Included by reference
                </span>
              )}
            </div>
          );

          return href ? (
            <Link
              aria-label={entry.name}
              className="group rounded-lg transition focus:outline-none focus:ring-2 focus:ring-brand-blue"
              href={href}
              key={entry.filename}
            >
              {card}
            </Link>
          ) : (
            <div aria-disabled="true" className="opacity-70" key={entry.filename}>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
