"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import type { CatalogEntry } from "@/lib/catalog";
import { sendRoutingTurn, type RoutingChatMessage } from "@/lib/routing";
import { hrefForCatalogEntry } from "@/lib/document-links";

const GREETING: RoutingChatMessage = {
  role: "assistant",
  content: "Not sure which document you need? Tell me about your deal and I'll point you to the closest one.",
};

export function RoutingChat({ catalog }: { catalog: CatalogEntry[] }) {
  const [messages, setMessages] = useState<RoutingChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedFilename, setSuggestedFilename] = useState<string | null>(null);
  const headingId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (!sending && hasSentRef.current) inputRef.current?.focus();
  }, [sending]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const userMessage: RoutingChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    hasSentRef.current = true;

    try {
      const result = await sendRoutingTurn(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
      setSuggestedFilename(result.suggestedFilename);
    } catch {
      setError("The assistant is temporarily unavailable. Browse the documents below instead.");
    } finally {
      setSending(false);
    }
  };

  const suggestedEntry = catalog.find((entry) => entry.filename === suggestedFilename);
  const suggestedHref = suggestedEntry ? hrefForCatalogEntry(suggestedEntry) : null;

  return (
    <section
      className="mb-8 space-y-4 rounded-lg border border-stone-200 bg-stone-50/60 p-5"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Not sure which document you need?
      </h2>

      <ol className="max-h-56 space-y-3 overflow-y-auto" aria-label="Chat transcript">
        {messages.map((message, index) => (
          <li
            key={index}
            className={
              message.role === "user"
                ? "ml-6 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white"
                : "mr-6 rounded-lg bg-white px-3 py-2 text-sm text-stone-800 shadow-sm"
            }
          >
            {message.content}
          </li>
        ))}
      </ol>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {suggestedEntry && suggestedHref ? (
        <Link
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
          href={suggestedHref}
        >
          Start drafting: {suggestedEntry.name} <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : null}

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          Message
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
          type="text"
          value={input}
          placeholder="e.g. We're licensing software to a customer and need a contract."
          disabled={sending}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          className="shrink-0 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={sending || !input.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
