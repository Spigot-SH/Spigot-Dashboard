/**
 * Pure-logic tests for `src/auth/sessionState.ts` — the `/auth/me` response validation this
 * repo's Codex round-2 rejection of 10c90b0 asked for (local/security-fixes/judge/f26d.q.out):
 *
 *   "src/auth/AuthContext.tsx:41,102: Validate the /auth/me response and accept only
 *   tutorialUnlocked === true. A null response must fail closed rather than crash the
 *   provider. Test missing, null and malformed values."
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`),
 * which strips TypeScript types but does not transform JSX. `parseSessionState` and
 * `SIGNED_OUT_STATE` were pulled out of `AuthContext.tsx` into `src/auth/sessionState.ts`
 * specifically so this plain-TS module (no JSX, no React import) can be loaded directly here —
 * `AuthContext.tsx` itself cannot be. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/auth/sessionState', '.ts'].join('');
const { parseSessionState, SIGNED_OUT_STATE } = await import(modulePath);

const VALID_USER = { id: 'u1', email: 'a@example.test', name: null, avatarUrl: null };

describe('parseSessionState — fails closed on a missing or malformed response', () => {
  test('undefined response (network/parse failure) is signed-out, not a crash', () => {
    assert.deepEqual(parseSessionState(undefined), SIGNED_OUT_STATE);
  });

  test('null response is signed-out, not a crash', () => {
    assert.deepEqual(parseSessionState(null), SIGNED_OUT_STATE);
  });

  test('a JSON scalar (proxy error page, not the API) is signed-out', () => {
    assert.deepEqual(parseSessionState('Internal Server Error'), SIGNED_OUT_STATE);
    assert.deepEqual(parseSessionState(0), SIGNED_OUT_STATE);
    assert.deepEqual(parseSessionState(false), SIGNED_OUT_STATE);
  });

  test('an array is signed-out', () => {
    assert.deepEqual(parseSessionState([]), SIGNED_OUT_STATE);
  });

  test('a well-formed unlocked response round-trips', () => {
    const raw = {
      user: VALID_USER,
      publisher: null,
      credits: 12.5,
      wallet: null,
      evmWallet: null,
      balances: null,
      tutorialUnlocked: true,
      providerAccess: 'approved',
    };
    assert.deepEqual(parseSessionState(raw), raw);
  });
});

describe('parseSessionState — tutorialUnlocked accepts only the exact boolean true', () => {
  test('missing tutorialUnlocked is locked', () => {
    assert.equal(parseSessionState({ user: VALID_USER }).tutorialUnlocked, false);
  });

  test('null tutorialUnlocked is locked', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: null }).tutorialUnlocked,
      false,
    );
  });

  test('the string "false" is locked — the Boolean(...) regression', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: 'false' }).tutorialUnlocked,
      false,
    );
  });

  test('the string "true" is locked (not the boolean true)', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: 'true' }).tutorialUnlocked,
      false,
    );
  });

  test('the number 1 is locked (not the boolean true)', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: 1 }).tutorialUnlocked,
      false,
    );
  });

  test('an empty object is locked (truthy but not true)', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: {} }).tutorialUnlocked,
      false,
    );
  });

  test('only the exact boolean true unlocks', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, tutorialUnlocked: true }).tutorialUnlocked,
      true,
    );
  });
});

describe('parseSessionState — other fields fail closed to safe defaults', () => {
  test('a non-object user is dropped to null, not passed through', () => {
    assert.equal(parseSessionState({ user: 'not-an-object' }).user, null);
  });

  test('a non-number credits is dropped to 0', () => {
    assert.equal(parseSessionState({ credits: '10' }).credits, 0);
    assert.equal(parseSessionState({ credits: NaN }).credits, 0);
  });

  test('a non-object wallet/evmWallet/balances/publisher is dropped to null', () => {
    const result = parseSessionState({
      wallet: 'x',
      evmWallet: 42,
      balances: true,
      publisher: [],
    });
    assert.equal(result.wallet, null);
    assert.equal(result.evmWallet, null);
    assert.equal(result.balances, null);
    assert.equal(result.publisher, null);
  });
});

describe('parseSessionState — providerAccess accepts only the three known server values', () => {
  test('missing providerAccess is null (not approved)', () => {
    assert.equal(parseSessionState({ user: VALID_USER }).providerAccess, null);
  });

  test('null providerAccess stays null', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, providerAccess: null }).providerAccess,
      null,
    );
  });

  test('an unrecognized string fails closed to null, not passed through', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, providerAccess: 'pending' }).providerAccess,
      null,
    );
  });

  test('a truthy non-string (the loose-read regression this guards against) fails closed to null', () => {
    assert.equal(
      parseSessionState({ user: VALID_USER, providerAccess: true }).providerAccess,
      null,
    );
    assert.equal(parseSessionState({ user: VALID_USER, providerAccess: 1 }).providerAccess, null);
  });

  test('requested, approved and revoked all round-trip exactly', () => {
    for (const value of ['requested', 'approved', 'revoked']) {
      assert.equal(
        parseSessionState({ user: VALID_USER, providerAccess: value }).providerAccess,
        value,
      );
    }
  });
});
