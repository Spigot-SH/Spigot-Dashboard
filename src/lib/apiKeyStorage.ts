/**
 * Pure `localStorage` helpers behind the publisher id and the legacy API key cleanup
 * (`src/api/client.ts`, `src/auth/AuthContext.tsx`). Pulled out into their own dependency-free
 * module — the same reason `src/auth/sessionState.ts` was pulled out of `AuthContext.tsx` — so
 * `clearLegacyApiKey` can be loaded directly by Node's `--test` runner
 * (`test/legacyApiKey.test.ts`): `client.ts` itself imports `parseCheckResponse` from
 * `../lib/domainVerification` with no file extension, which only a bundler (tsc's
 * `moduleResolution: "bundler"`, used by `next build`) resolves — Node's own ESM loader cannot
 * follow that import, so `client.ts` cannot be loaded directly there. `client.ts` re-exports
 * everything here so the rest of the app's imports do not change.
 */

// Publisher calls authenticate with the httpOnly session cookie only. The API key is for
// server-to-server use; the browser never stores or sends it. This name is kept only so
// clearAuth() and clearLegacyApiKey() can delete a key saved by an older build.
export const API_KEY_STORAGE_KEY = 'x402_api_key';
export const PUBLISHER_ID_STORAGE_KEY = 'x402_publisher_id';

export function setPublisherId(id: string): void {
  localStorage.setItem(PUBLISHER_ID_STORAGE_KEY, id);
}

export function getPublisherId(): string | null {
  return localStorage.getItem(PUBLISHER_ID_STORAGE_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(PUBLISHER_ID_STORAGE_KEY);
}

/**
 * Delete a key an older build left in localStorage, on load — not only at sign-out. A
 * browser that is already signed in when it upgrades to this build never fires sign-out, so
 * that alone left the key sitting there indefinitely. Safe to call before a session exists:
 * it only touches storage.
 */
export function clearLegacyApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage can throw (private mode, disabled storage) — nothing to clean up then.
  }
}
