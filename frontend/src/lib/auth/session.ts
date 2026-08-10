/**
 * Client-side session storage.
 *
 * There is no real authentication yet — the backend signup/login endpoints
 * check for an existing/missing account by email but never a password — so
 * "signed in" just means a session object sits in localStorage. The static
 * export has no server at request time, so
 * there is no middleware or cookie to gate routes with; every gated page
 * checks this directly (see RequireSession).
 */

const STORAGE_KEY = "prelegal:session";

export interface Session {
  id: string;
  email: string;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function hasSession(): boolean {
  return getSession() !== null;
}
