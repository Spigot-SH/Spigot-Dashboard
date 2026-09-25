/**
 * Pure-logic tests for `src/views/providerAccessFlow.ts`, the request-provider-access flow
 * (feat: provider-access). Mirrors `test/dashboardUnlock.test.ts` — same reasoning: whether
 * `requestAccess` itself resolved or threw is not the answer, only a freshly re-read session
 * says what the server actually recorded. `requestAccess` and `refreshSession` stand in for
 * `authApi.requestProviderAccess` (`src/api/auth.ts`) and `AuthContext`'s `refresh()`.
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`);
 * `providerAccessFlow.ts` has no JSX, so it loads directly here the same way
 * `dashboardUnlock.ts` does. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/views/providerAccessFlow', '.ts'].join('');
const { runProviderAccessRequestFlow } = await import(modulePath);

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

describe('runProviderAccessRequestFlow — the request threw', () => {
  test('requested is false when the refreshed session still shows nothing asked', async () => {
    const requestAccess = async () => {
      throw httpError(429, 'Too many requests');
    };
    const refreshSession = async () => ({ providerAccess: null });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, false);
    assert.equal(result.session.providerAccess, null);
  });

  test('requested is true when the refresh shows the request landed despite the throw', async () => {
    // A dropped response can follow a write that actually committed — the idempotent
    // request endpoint means a retry is harmless either way, but this flow must not report
    // "not requested" on the strength of the failed response alone.
    const requestAccess = async () => {
      throw httpError(500, 'Internal error');
    };
    const refreshSession = async () => ({ providerAccess: 'requested' });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, true);
  });
});

describe('runProviderAccessRequestFlow — the ledger/session state decides, not the request outcome', () => {
  test('a clean success followed by a confirming refresh reports requested', async () => {
    const requestAccess = async () => ({ success: true, providerAccess: 'requested' });
    const refreshSession = async () => ({ providerAccess: 'requested' });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, true);
  });

  test('a clean-looking success is not enough on its own — only the refresh decides', async () => {
    const requestAccess = async () => ({ success: true, providerAccess: 'requested' });
    const refreshSession = async () => ({ providerAccess: null });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, false);
  });

  test('an already-approved account reports requested too (nothing left to ask for)', async () => {
    const requestAccess = async () => ({ success: true, alreadyRequested: true });
    const refreshSession = async () => ({ providerAccess: 'approved' });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, true);
  });

  test('a revoked account is not "requested" until it asks again', async () => {
    const requestAccess = async () => ({ success: true });
    const refreshSession = async () => ({ providerAccess: 'revoked' });

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, false);
  });

  test('an undefined providerAccess (old backend) is treated as not requested', async () => {
    const requestAccess = async () => ({ success: true });
    const refreshSession = async () => ({});

    const result = await runProviderAccessRequestFlow(requestAccess, refreshSession);

    assert.equal(result.requested, false);
  });
});
