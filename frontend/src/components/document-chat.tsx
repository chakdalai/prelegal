"use client";

import { useEffect, useId, useRef, useState } from "react";

import { fieldsPatchSince, sendChatTurn, type ChatMessage } from "@/lib/documents/chat";
import type { DocumentFormData } from "@/lib/documents/fields";
import type { DocumentConfig } from "@/lib/documents/registry";

export interface DocumentChatProps {
  config: DocumentConfig;
  data: DocumentFormData;
  /** Applied as a patch (only the fields the turn actually changed), the
   * same way the manual form's own edits are — so a reply arriving after
   * the user has kept editing the form doesn't clobber that edit. */
  onFieldsUpdate: (patch: Partial<DocumentFormData>) => void;
}

export function DocumentChat({ config, data, onFieldsUpdate }: DocumentChatProps) {
  const greeting: ChatMessage = {
    role: "assistant",
    content: `Hi! Tell me about the deal and I'll fill in the ${config.title} Cover Page as we go — you can also edit the form directly at any time.`,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentRef = useRef(false);

  // Once a turn finishes — reply or error — focus returns to the input, so
  // the user can keep typing without reaching for the mouse.
  useEffect(() => {
    if (!sending && hasSentRef.current) inputRef.current?.focus();
  }, [sending]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    hasSentRef.current = true;

    try {
      const result = await sendChatTurn(config.slug, nextMessages, data);
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
      onFieldsUpdate(fieldsPatchSince(data, result.fields));
    } catch {
      // The user's message stays in the transcript so nothing is lost; the
      // rest of the app (form, preview, download) is unaffected.
      setError(
        "The assistant is temporarily unavailable. You can keep filling in the form directly, or try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/60 p-5"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Chat with the assistant
      </h2>

      <ol className="max-h-72 space-y-3 overflow-y-auto" aria-label="Chat transcript">
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
          placeholder={`e.g. This is for a deal with Acme, Inc.`}
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
