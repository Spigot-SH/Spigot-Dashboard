/**
 * Pure-logic tests for `src/views/dashboardUnlock.ts` — the Codex round-2 regression on
 * 10c90b0 (local/security-fixes/judge/f26d.q.out):
 *
 *   "An unlock failure still opens the tutorial as though the debit succeeded
 *   (src/views/Dashboard.tsx:123-131)."
 *   "src/views/Dashboard.tsx:123-131: After a rejected or uncertain unlock request, open the
 *   tutorial only when a refreshed session confirms the ledger unlock. Test the 402, 500 and
 *   timeout outcomes."
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`);
 * `Dashboard.tsx` has JSX, which Node's `--experimental-strip-types` does not transform, so
 * `runUnlockFlow` was pulled out into a plain-TS module specifically so this file can load it
 * directly. `requestUnlock` and `refreshSession` are injected functions here, standing in for
 * `creditsApi.unlockTutorial` (`src/api/credits.ts`) and `AuthContext`'s `refresh()`
 * (`src/auth/AuthContext.tsx`) — `api/request.ts` throws an `Error` with a `.status` for a 402
 * or a 500, and a `.status: 0` for a timeout/dropped connection (`fetch` rejecting), which is
 * what these fakes reproduce. In every case the ledger's own state — what `refreshSession`
 * returns — is what decides whether the tutorial opens, never whether `requestUnlock` threw.
 * Run with `npm test` or `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/views/dashboardUnlock', '.ts'].join('');
const { runUnlockFlow } = await import(modulePath);

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });
const timeoutError = () =>
  Object.assign(new Error('Could not reach the server. Check your connection.'), { status: 0 });

describe('runUnlockFlow — 402 insufficient credit', () => {
  test('the tutorial does not open when the refreshed session is still locked', async () => {
    const requestUnlock = async () => {
      throw httpError(402, 'Insufficient credit');
    };
    const refreshSession = async () => ({ tutorialUnlocked: false });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, false);
    assert.equal(result.session.tutorialUnlocked, false);
  });
});

describe('runUnlockFlow — 500 server error', () => {
  test('the tutorial does not open when the refresh shows the debit never landed', async () => {
    const requestUnlock = async () => {
      throw httpError(500, 'Could not unlock tutorial');
    };
    const refreshSession = async () => ({ tutorialUnlocked: false });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, false);
  });

  test('the tutorial opens when the refresh shows the debit landed despite the 500', async () => {
    // A 500 can follow a write that actually committed (e.g. the response failed to encode).
    // Only the ledger, read back by `refreshSession`, gets to decide — not the failed response.
    const requestUnlock = async () => {
      throw httpError(500, 'Could not unlock tutorial');
    };
    const refreshSession = async () => ({ tutorialUnlocked: true });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, true);
  });
});

describe('runUnlockFlow — timeout / dropped connection', () => {
  test('the tutorial does not open when nothing reached the ledger', async () => {
    const requestUnlock = async () => {
      throw timeoutError();
    };
    const refreshSession = async () => ({ tutorialUnlocked: false });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, false);
  });

  test('the tutorial opens when the request actually landed before the client gave up', async () => {
    const requestUnlock = async () => {
      throw timeoutError();
    };
    const refreshSession = async () => ({ tutorialUnlocked: true });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, true);
  });
});

describe('runUnlockFlow — the ledger confirms the unlock, regardless of the request outcome', () => {
  test('a clean success followed by a confirming refresh opens the tutorial', async () => {
    const requestUnlock = async () => ({ success: true, unlocked: true });
    const refreshSession = async () => ({ tutorialUnlocked: true });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, true);
  });

  test('a clean-looking success is not enough on its own — only the refresh decides', async () => {
    // Guards the exact regression: previously the code opened the tutorial as soon as the
    // request resolved, without waiting on what the refreshed session actually said.
    const requestUnlock = async () => ({ success: true, unlocked: true });
    const refreshSession = async () => ({ tutorialUnlocked: false });

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, false);
  });

  test('an undefined tutorialUnlocked (old backend) is treated as locked, not unlocked', async () => {
    const requestUnlock = async () => ({ success: true });
    const refreshSession = async () => ({});

    const result = await runUnlockFlow(requestUnlock, refreshSession);

    assert.equal(result.opened, false);
  });
});
