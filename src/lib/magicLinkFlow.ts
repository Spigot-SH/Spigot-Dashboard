/**
 * Pure logic for `/login/magic-link` (src/views/MagicLinkCallback.tsx) and the error banner on
 * `/login` (src/auth/SignInPanel.tsx): no React, no fetch, no other repo modules — mirrors
 * src/lib/domainVerification.ts and src/lib/gatewayUrl.ts so both the UI and the Node test
 * runner (test/magicLinkFlow.test.ts) import the exact same logic.
 *
 * Follows up commit 4cfb070, which added the fragment-and-POST callback. A second review found
 * three problems this file exists to fix without touching React state: the callback could route
 * a browser into a signed-out or wrong-user session left over in the shared AuthProvider; the
 * fragment could be read and POSTed more than once (React Strict Mode's double effect, a
 * remount, two tabs); and a failed POST put arbitrary backend text into `?auth_error=`, which
 * `SignInPanel.tsx` never displayed.
 */

/**
 * Where the `beforeInteractive` guard script in `src/app/layout.tsx` stashes `location.hash`
 * on `/login/magic-link`, and where `MagicLinkCallback.tsx` reads it back from. One constant so
 * the two can never drift onto different keys.
 */
export const MAGIC_LINK_FRAGMENT_STASH_KEY = 'spigot_magic_link_fragment';

/** The fragment a magic-link email points at: `#token=...&email=...`. */
export interface MagicLinkFragment {
  token: string;
  email: string;
}

/** Parses `location.hash` (with or without the leading `#`). `null` when either field is missing. */
export const parseMagicLinkFragment = (hash: string): MagicLinkFragment | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  if (!token || !email) return null;
  return { token, email };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `POST /auth/magic-link/callback` is cast to `{ ok: true }` with no runtime check (same gap
 * `sessionState.ts` closed for `/auth/me`). A 200 with a malformed or empty body — a proxy error
 * page, a truncated response — must not be read as a successful sign-in.
 */
export const isSuccessfulVerifyResponse = (body: unknown): body is { ok: true } =>
  isRecord(body) && body.ok === true;

/**
 * The five codes this page ever puts in `?auth_error=`. Never the backend's raw error text —
 * that was commit 4cfb070's gap: `router.replace('/login?auth_error=' + err.message)` put
 * whatever string the backend (or a proxy) returned straight into the URL and `SignInPanel.tsx`
 * never read it back out to show it.
 *
 * `'coming_soon'` (the pre-existing whitelist gate, unrelated to this fix) is handled alongside
 * these but kept out of the fixed set on purpose — `SignInPanel.tsx` already has its own banner
 * for it and must keep working exactly as before.
 */
export type MagicLinkErrorCode = 'invalid' | 'expired' | 'suspended' | 'network' | 'link_expired';

const MAGIC_LINK_ERROR_CODES: readonly MagicLinkErrorCode[] = [
  'invalid',
  'expired',
  'suspended',
  'network',
  'link_expired',
];

export const isMagicLinkErrorCode = (value: string | null): value is MagicLinkErrorCode =>
  value !== null && (MAGIC_LINK_ERROR_CODES as readonly string[]).includes(value);

export const MAGIC_LINK_ERROR_MESSAGES: Record<MagicLinkErrorCode, string> = {
  invalid: 'This sign-in link is invalid or has already been used. Request a new one.',
  expired: 'This sign-in link has expired. Request a new one.',
  suspended: 'This account has been suspended. Contact support if you think this is a mistake.',
  network: 'Could not reach the server. Check your connection, then request a new link.',
  link_expired: 'This sign-in link is from an older email and no longer works. Request a new one.',
};

/** Shape `request()` (src/api/request.ts) throws: `Error` plus `status` and the parsed body. */
interface VerifyErrorLike {
  status?: unknown;
  body?: { error?: unknown };
}

const asVerifyError = (error: unknown): VerifyErrorLike =>
  isRecord(error) ? (error as VerifyErrorLike) : {};

/**
 * Maps whatever `authApi.verifyMagicLink` throws to a fixed code (or the pre-existing
 * `'coming_soon'`), never the raw backend string.
 *
 * `status: 0` is `request()`'s own marker for "fetch never completed" (offline, DNS, connection
 * refused — see request.ts) rather than a response the backend sent, so it maps to `'network'`
 * ahead of reading the body. The backend's callback route (`Spigot-Algorand` routes/auth.ts)
 * answers a bad or reused token with the single string `'invalid_or_expired_link'`, which does
 * not itself distinguish invalid from expired — that collapses to `'invalid'`. `'link_expired'`
 * is reserved for the old GET-route redirect (`?error=link_expired`, read in SignInPanel.tsx),
 * kept as a separate code because it means something different to the user: an old email, not a
 * spent or malformed link.
 */
export const classifyVerifyError = (error: unknown): MagicLinkErrorCode | 'coming_soon' => {
  const e = asVerifyError(error);
  if (e.status === 0) return 'network';
  const code = typeof e.body?.error === 'string' ? e.body.error : '';
  if (code === 'coming_soon') return 'coming_soon';
  if (code === 'account_suspended') return 'suspended';
  if (code === 'link_expired') return 'link_expired';
  if (code && code !== 'invalid_or_expired_link' && /expired/i.test(code)) return 'expired';
  return 'invalid';
};

/** The minimal shape of a refreshed session this file needs — see `api/auth.ts`'s `SessionState`. */
export interface MinimalSession {
  user: { email: string } | null;
}

/**
 * Whether a freshly refreshed session (`useAuth().refresh()`, not the possibly-stale React
 * state) is signed in as the email the magic link was sent to.
 *
 * This is the check the callback was missing: `AuthContext`'s `AuthProvider` is a single
 * provider that outlives navigation, so a browser that was already signed in as someone else —
 * or was signed out and had not refreshed yet — could reach `router.replace('/?signed_in=1')`
 * before its state reflected the session the backend had just created. Only a refresh that
 * matches the target email counts as "this callback signed this browser in."
 */
export const sessionMatchesEmail = (session: MinimalSession, email: string): boolean =>
  Boolean(
    session.user &&
    session.user.email &&
    email &&
    session.user.email.toLowerCase() === email.toLowerCase(),
  );

/**
 * Runs `fn` at most once per distinct `key`, sharing that single (still-pending or already
 * settled) promise with every later call for the same key.
 *
 * Backs the module-level guard in `MagicLinkCallback.tsx` that keeps the POST to
 * `/auth/magic-link/callback` from going out twice: React Strict Mode's dev-only double
 * invocation of an effect, and a remount of the same page (routed away from and back to without
 * a full reload) both re-run the effect, but they run against the *same* module instance, so
 * the second call finds the first call's promise already cached and awaits that instead of
 * firing a second request. A hard page reload or a second tab gets a fresh module instance —
 * each POSTs at most once for itself, and the backend's single-use token setting `consumed_at`
 * (`Spigot-Algorand` routes/auth.ts `consumeToken`) is what keeps a second tab's POST from
 * succeeding twice, not this cache.
 */
export const createRunOnce = <T>(): ((key: string, fn: () => Promise<T>) => Promise<T>) => {
  const calls = new Map<string, Promise<T>>();
  return (key, fn) => {
    const existing = calls.get(key);
    if (existing) return existing;
    const started = fn();
    calls.set(key, started);
    return started;
  };
};
