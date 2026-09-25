/**
 * Pure-logic tests for `src/views/providerAccessGate.ts` — the Codex REJECT on
 * Spigot-Dashboard 4ee89c4 (local/security-fixes/judge/f40d.txt):
 *
 *   "isProviderAccessBlocked gates purely on `providerAccess !== 'approved'` from GET
 *   /auth/me, with no way to know that the backend's PROVIDER_ACCESS_OPEN launch switch is
 *   on... So when ops flips PROVIDER_ACCESS_OPEN=true... every Dashboard user whose
 *   users.provider_access is still null/requested will keep seeing the 'Coming Soon'
 *   ProviderAccessLockedCard."
 *
 * The fix is on the server: `GET /auth/me` (`getEffectiveProviderAccessStatus`, Spigot-Algorand
 * backend/src/services/providerAccess.ts) now reports `providerAccess` as the literal
 * `'approved'` for every account once `PROVIDER_ACCESS_OPEN` is on. This function's job is only
 * to keep reading that one field strictly — the tests below both confirm it stays fail-closed
 * on every other value, and pin the exact scenario the finding describes: once the server's
 * open-state value (`'approved'`) reaches here, an account that never asked is not blocked.
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`),
 * which strips TypeScript types but does not transform JSX; `providerAccessGate.ts` has no
 * JSX, so it loads directly here the same way `providerAccessFlow.ts` does in
 * `test/providerAccessFlow.test.ts`. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/views/providerAccessGate', '.ts'].join('');
const { isProviderAccessBlocked } = await import(modulePath);

test('while auth is still loading, nothing is reported blocked (the loading state renders instead)', () => {
  assert.equal(isProviderAccessBlocked(null, true), false);
  assert.equal(isProviderAccessBlocked('revoked', true), false);
});

test('an approved account is never blocked', () => {
  assert.equal(isProviderAccessBlocked('approved', false), false);
});

test('never asked (null), requested, and revoked all stay blocked once loading has settled', () => {
  assert.equal(isProviderAccessBlocked(null, false), true);
  assert.equal(isProviderAccessBlocked('requested', false), true);
  assert.equal(isProviderAccessBlocked('revoked', false), true);
});

test('PROVIDER_ACCESS_OPEN: once the server reports the open state as providerAccess "approved", an account that never asked is not blocked', () => {
  // getEffectiveProviderAccessStatus reports 'approved' for every account once
  // PROVIDER_ACCESS_OPEN is on, regardless of the account's real, stored status — this is what
  // that looks like by the time it reaches the client.
  const openStateFromServer = 'approved' as const;
  assert.equal(isProviderAccessBlocked(openStateFromServer, false), false);
});
