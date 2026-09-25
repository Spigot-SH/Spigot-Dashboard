import type { SessionState, AuthUser, PublisherInfo, WalletInfo, Balances } from '../api/auth';

/**
 * Pulled out of `AuthContext.tsx` so it can be unit tested with Node's own `--test` runner
 * (`test/*.test.ts`, see `test/domainVerification.test.ts`) — that file has no JSX and no React
 * import, which `AuthContext.tsx` cannot say, and Node's `--experimental-strip-types` strips
 * TypeScript types but does not transform JSX.
 */
export const SIGNED_OUT_STATE: SessionState = {
  user: null,
  publisher: null,
  credits: 0,
  wallet: null,
  evmWallet: null,
  balances: null,
  tutorialUnlocked: false,
  providerAccess: null,
};

const PROVIDER_ACCESS_VALUES = new Set(['requested', 'approved', 'revoked']);

/**
 * Reads `providerAccess` the same way `tutorialUnlocked` is read below: strictly, so anything
 * that is not one of the three known server values fails closed to `null` (not approved). A
 * loose truthy read here would let any non-empty string — including a stray `"false"` — count
 * as approved.
 */
const parseProviderAccess = (value: unknown): 'requested' | 'approved' | 'revoked' | null =>
  typeof value === 'string' && PROVIDER_ACCESS_VALUES.has(value)
    ? (value as 'requested' | 'approved' | 'revoked')
    : null;

/** An object, not an array — `typeof [] === 'object'` and `Array.isArray` is easy to forget. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A user object must carry the two fields every other consumer treats as always present
 * (`AuthUser.id`, `AuthUser.email`) — `user: {}` is a record but carries no identity, and
 * `Boolean(state.user)` (`AuthContext.tsx`'s `signedIn`) would still read an empty object as
 * signed in.
 */
const isValidUser = (value: unknown): value is AuthUser =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  typeof value.email === 'string' &&
  value.email.length > 0;

/**
 * `/auth/me` is cast to `SessionState` by `request<T>` (`api/request.ts`) with no runtime
 * check — a TypeScript generic proves nothing about what actually arrived on the wire. A
 * malformed body (not an object, `null`, an array, a JSON scalar left over from a proxy error
 * page, or a partial object missing a valid `user`) must fail closed to the whole signed-out
 * shape — every entitlement false, not just `user: null` with everything else read at face
 * value — rather than crash the provider or leak an entitlement while signed out. A response
 * such as `{ tutorialUnlocked: true }` (no `user` at all) or `{ user: {} }` (a user with no
 * identity) both hit this and return `SIGNED_OUT_STATE` wholesale.
 *
 * `tutorialUnlocked` — the money-gated flag — must only ever be `true` for the exact boolean
 * `true`. `Boolean("false")` is `true`, which is the bug this replaces: any truthy value used
 * to count as unlocked.
 */
export const parseSessionState = (raw: unknown): SessionState => {
  if (!isRecord(raw) || !isValidUser(raw.user)) return SIGNED_OUT_STATE;
  return {
    user: raw.user,
    publisher: isRecord(raw.publisher) ? (raw.publisher as unknown as PublisherInfo) : null,
    credits: typeof raw.credits === 'number' && Number.isFinite(raw.credits) ? raw.credits : 0,
    wallet: isRecord(raw.wallet) ? (raw.wallet as unknown as WalletInfo) : null,
    evmWallet: isRecord(raw.evmWallet) ? (raw.evmWallet as unknown as WalletInfo) : null,
    balances: isRecord(raw.balances) ? (raw.balances as unknown as Balances) : null,
    // Strict equality, not `Boolean(...)`: a string, a number, or anything else the server
    // (or a broken proxy in between) sends must never be treated as unlocked.
    tutorialUnlocked: raw.tutorialUnlocked === true,
    providerAccess: parseProviderAccess(raw.providerAccess),
  };
};
