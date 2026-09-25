/**
 * Pure-logic tests for `src/auth/authRefreshSequence.ts` — Codex round 3, item 2
 * (AuthContext.tsx:52-70, MagicLinkCallback.tsx:115-124):
 *
 *   "An older session refresh must never apply after the callback's verified refresh. Use a
 *   monotonically increasing request sequence in AuthContext and ignore any stale response.
 *   Test signed-out and previous-user sessions with responses arriving out of order."
 *
 * Same runner as test/magicLinkFlow.test.ts and test/dashboardUnlock.test.ts: Node's own
 * `--test`. `createRefreshSequencer` has no React and no `window`, so it is tested directly here
 * with a small harness that reproduces `AuthContext.tsx`'s `refresh()` — `start()` a ticket
 * before the async `/auth/me` call, then only apply the result when `isCurrent()` says no newer
 * call has started since. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/auth/authRefreshSequence', '.ts'].join('');
const { createRefreshSequencer } = await import(modulePath);

/** Mirrors AuthContext.tsx's `refresh()`: start a ticket, await the fetch, apply only if current. */
const simulateRefresh = async <T>(
  sequencer: ReturnType<typeof createRefreshSequencer>,
  fetchMe: () => Promise<T>,
  applied: T[],
): Promise<T> => {
  const ticket = sequencer.start();
  const next = await fetchMe();
  if (sequencer.isCurrent(ticket)) {
    applied.push(next);
  }
  return next;
};

describe('createRefreshSequencer', () => {
  test('a single call is current and applies', () => {
    const sequencer = createRefreshSequencer();
    const ticket = sequencer.start();
    assert.equal(sequencer.isCurrent(ticket), true);
  });

  test('an older ticket is no longer current once a newer call has started', () => {
    const sequencer = createRefreshSequencer();
    const older = sequencer.start();
    const newer = sequencer.start();
    assert.equal(sequencer.isCurrent(older), false);
    assert.equal(sequencer.isCurrent(newer), true);
  });

  test('a signed-out session from an older call does not overwrite a newer verified sign-in that resolved first', async () => {
    // AuthProvider's own mount effect (signed-out cookie, slow) races the magic-link callback's
    // refresh() (verified session, fast) — the exact shape of the regression.
    const sequencer = createRefreshSequencer();
    const applied: Array<{ user: { email: string } | null }> = [];

    const mountRefresh = simulateRefresh(
      sequencer,
      () => new Promise(resolve => setTimeout(() => resolve({ user: null }), 20)),
      applied,
    );
    const callbackRefresh = simulateRefresh(
      sequencer,
      () => Promise.resolve({ user: { email: 'a@b.com' } }),
      applied,
    );

    await Promise.all([mountRefresh, callbackRefresh]);

    assert.deepEqual(applied, [{ user: { email: 'a@b.com' } }]);
  });

  test('a previous user’s session from an older call does not overwrite the newer verified session', async () => {
    const sequencer = createRefreshSequencer();
    const applied: Array<{ user: { email: string } | null }> = [];

    const staleRefresh = simulateRefresh(
      sequencer,
      () => new Promise(resolve => setTimeout(() => resolve({ user: { email: 'old@b.com' } }), 20)),
      applied,
    );
    const verifiedRefresh = simulateRefresh(
      sequencer,
      () => Promise.resolve({ user: { email: 'new@b.com' } }),
      applied,
    );

    await Promise.all([staleRefresh, verifiedRefresh]);

    assert.deepEqual(applied, [{ user: { email: 'new@b.com' } }]);
  });

  test('responses arriving in start order still apply only the latest', async () => {
    const sequencer = createRefreshSequencer();
    const applied: Array<{ user: { email: string } | null }> = [];

    await simulateRefresh(
      sequencer,
      () => Promise.resolve({ user: { email: 'first@b.com' } }),
      applied,
    );
    await simulateRefresh(
      sequencer,
      () => Promise.resolve({ user: { email: 'second@b.com' } }),
      applied,
    );

    assert.deepEqual(applied, [
      { user: { email: 'first@b.com' } },
      { user: { email: 'second@b.com' } },
    ]);
  });

  test('a stale call still returns its own fetched value to its own caller, even though it is not applied', async () => {
    const sequencer = createRefreshSequencer();
    const applied: Array<{ user: { email: string } | null }> = [];

    const stale = simulateRefresh(
      sequencer,
      () => new Promise(resolve => setTimeout(() => resolve({ user: null }), 20)),
      applied,
    );
    await simulateRefresh(
      sequencer,
      () => Promise.resolve({ user: { email: 'a@b.com' } }),
      applied,
    );

    const staleResult = await stale;
    assert.deepEqual(staleResult, { user: null });
    assert.deepEqual(applied, [{ user: { email: 'a@b.com' } }]);
  });
});
