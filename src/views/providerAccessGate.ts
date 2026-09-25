/**
 * Whether `Dashboard.tsx` should show the provider-access locked state instead of its real
 * content (the sidebar, ApisView, AnalyticsView, and the overview figures). Pulled out of
 * `Dashboard.tsx`'s inline `isProviderAccessBlocked` the same way `runUnlockFlow`
 * (`dashboardUnlock.ts`) and `runProviderAccessRequestFlow` (`providerAccessFlow.ts`) were, so
 * the contract with the server is one small, independently testable function instead of an
 * expression buried in a component (see `test/dashboardUnlock.test.ts` for why: this repo's only
 * test runner is Node's own `--test`, and `Dashboard.tsx` has JSX, which Node's
 * `--experimental-strip-types` does not transform).
 *
 * f40d.txt (Codex REJECT on Spigot-Dashboard 4ee89c4): this used to read `providerAccess`
 * straight off `GET /auth/me`, which reported the raw, un-flag-aware DB column. Once ops flips
 * the backend's `PROVIDER_ACCESS_OPEN` launch switch, every gated route accepts every caller
 * (`isProviderApproved`, Spigot-Algorand backend/src/services/providerAccess.ts) — but the
 * Dashboard kept showing the locked card to every account whose stored `provider_access` was
 * still `null`/`requested`/`revoked`, because nothing here knew the switch existed.
 *
 * The fix lives on the server, not here: `GET /auth/me` now reports `providerAccess` as the
 * literal `'approved'` for every account once `PROVIDER_ACCESS_OPEN` is on
 * (`getEffectiveProviderAccessStatus`, same file) — the same value an actually-approved account
 * has always sent. This function's contract is unchanged and deliberately stays that way: it
 * fails closed on anything that is not the exact literal `'approved'`, the same strict read
 * `AuthContext.tsx`'s `providerAccess` already enforces (never a truthy-string check), and it
 * must never grow a second, flag-aware branch of its own that could disagree with the server
 * about who is unblocked.
 */
export const isProviderAccessBlocked = (
  providerAccess: 'requested' | 'approved' | 'revoked' | null,
  authLoading: boolean,
): boolean => !authLoading && providerAccess !== 'approved';
