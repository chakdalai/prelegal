"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession, setSession } from "@/lib/auth/session";

const BUTTON_CLASS =
  "w-full rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

type Mode = "sign-in" | "sign-up";

const ENDPOINT: Record<Mode, string> = {
  "sign-in": "/api/auth/login",
  "sign-up": "/api/auth/signup",
};

/**
 * On failure, offers to switch modes rather than just reporting an error:
 * with no password to distinguish "wrong credentials" from "wrong mode",
 * a mode-specific 404/409 is the only signal telling the user which one
 * they should be in.
 */
const MODE_ERROR: Record<Mode, string> = {
  "sign-in": "No account found for this email. Try signing up instead.",
  "sign-up": "An account with this email already exists. Try signing in instead.",
};

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getSession()) {
      router.replace("/dashboard/");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Passwordless: the backend never checks one, so nothing beyond email
      // is sent. What signup/sign-in now distinguish is whether the account
      // already exists — see ENDPOINT/MODE_ERROR.
      const response = await fetch(ENDPOINT[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          setError(MODE_ERROR[mode]);
        } else {
          setError("Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      const session = await response.json();
      setSession(session);
      router.replace("/dashboard/");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-6">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-brand-navy">Prelegal</h1>
        <p className="mt-1 text-sm text-brand-gray">
          {mode === "sign-in" ? "Sign in to your account." : "Create an account to get started."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-stone-700" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className={`${BUTTON_CLASS} bg-brand-purple text-white hover:opacity-90 focus:ring-brand-purple`}
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-brand-blue hover:underline"
          onClick={switchMode}
          type="button"
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
