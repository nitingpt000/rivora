import type { SessionUser } from '@rivora/api-client';

/**
 * The signed-in session.
 *
 * Held in `sessionStorage` rather than `localStorage`: a bearer token that
 * survives closing the tab is a token an attacker has longer to find, and the
 * API issues short-lived ones precisely so the window stays small. The cost is
 * signing in again in a new tab, which is one wallet prompt.
 *
 * An httpOnly cookie would be better still — unreachable from JavaScript
 * entirely — but the API returns the token in the response body, so that is a
 * change on both sides rather than a client-side choice.
 */
const STORAGE_KEY = 'rivora-session';

export type AuthStatus = 'anonymous' | 'signing' | 'authenticated' | 'error';

export interface StoredSession {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  user: SessionUser;
}

export function loadSession(): StoredSession | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSession;

    // A token past its expiry is worse than none: it makes every request fail
    // with a 401 that looks like a server problem rather than a stale login.
    if (!parsed.token || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
