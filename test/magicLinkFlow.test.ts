/**
 * Pure-logic tests for `src/lib/magicLinkFlow.ts`.
 *
 * Same runner as test/domainVerification.test.ts and test/gatewayUrl.test.ts: Node's own
 * `--test`, no new dependency. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/lib/magicLinkFlow', '.ts'].join('');
const {
  parseMagicLinkFragment,
  isSuccessfulVerifyResponse,
  classifyVerifyError,
  isMagicLinkErrorCode,
  sessionMatchesEmail,
  createRunOnce,
  MAGIC_LINK_ERROR_MESSAGES,
} = await import(modulePath);

describe('parseMagicLinkFragment', () => {
  test('reads token and email off a leading-# hash', () => {
    assert.deepEqual(parseMagicLinkFragment('#token=abc123&email=a%40b.com'), {
      token: 'abc123',
      email: 'a@b.com',
    });
  });

  test('reads token and email with no leading #', () => {
    assert.deepEqual(parseMagicLinkFragment('token=abc123&email=a%40b.com'), {
      token: 'abc123',
      email: 'a@b.com',
    });
  });

  test('rejects a missing token', () => {
    assert.equal(parseMagicLinkFragment('#email=a%40b.com'), null);
  });

  test('rejects a missing email', () => {
    assert.equal(parseMagicLinkFragment('#token=abc123'), null);
  });

  test('rejects an empty fragment', () => {
    assert.equal(parseMagicLinkFragment(''), null);
    assert.equal(parseMagicLinkFragment('#'), null);
  });

  test('rejects an empty-string token or email', () => {
    assert.equal(parseMagicLinkFragment('#token=&email=a%40b.com'), null);
    assert.equal(parseMagicLinkFragment('#token=abc123&email='), null);
  });
});

describe('isSuccessfulVerifyResponse', () => {
  test('accepts { ok: true }', () => {
    assert.equal(isSuccessfulVerifyResponse({ ok: true }), true);
  });

  test('rejects a missing ok field', () => {
    assert.equal(isSuccessfulVerifyResponse({}), false);
  });

  test('rejects ok as a truthy non-boolean', () => {
    assert.equal(isSuccessfulVerifyResponse({ ok: 'true' }), false);
    assert.equal(isSuccessfulVerifyResponse({ ok: 1 }), false);
  });

  test('rejects null, undefined, an array, and a scalar', () => {
    assert.equal(isSuccessfulVerifyResponse(null), false);
    assert.equal(isSuccessfulVerifyResponse(undefined), false);
    assert.equal(isSuccessfulVerifyResponse([]), false);
    assert.equal(isSuccessfulVerifyResponse('ok'), false);
  });
});

describe('classifyVerifyError', () => {
  test('a request()-shaped network failure (status 0) maps to network', () => {
    assert.equal(
      classifyVerifyError(Object.assign(new Error('offline'), { status: 0 })),
      'network',
    );
  });

  test("the backend's collapsed invalid-or-expired string maps to invalid", () => {
    assert.equal(
      classifyVerifyError(
        Object.assign(new Error('x'), { status: 401, body: { error: 'invalid_or_expired_link' } }),
      ),
      'invalid',
    );
  });

  test('account_suspended maps to suspended', () => {
    assert.equal(
      classifyVerifyError(
        Object.assign(new Error('x'), { status: 403, body: { error: 'account_suspended' } }),
      ),
      'suspended',
    );
  });

  test('coming_soon passes through unchanged', () => {
    assert.equal(
      classifyVerifyError(
        Object.assign(new Error('x'), { status: 403, body: { error: 'coming_soon' } }),
      ),
      'coming_soon',
    );
  });

  test('link_expired maps to link_expired', () => {
    assert.equal(
      classifyVerifyError(
        Object.assign(new Error('x'), { status: 410, body: { error: 'link_expired' } }),
      ),
      'link_expired',
    );
  });

  test('a distinct expired code maps to expired, not invalid', () => {
    assert.equal(
      classifyVerifyError(
        Object.assign(new Error('x'), { status: 401, body: { error: 'token_expired' } }),
      ),
      'expired',
    );
  });

  test('a malformed success body (this file’s own guard) maps to invalid', () => {
    assert.equal(
      classifyVerifyError(Object.assign(new Error('Malformed response'), { status: 502 })),
      'invalid',
    );
  });

  test('an error with no body, no status, or not an object at all maps to invalid', () => {
    assert.equal(classifyVerifyError(new Error('boom')), 'invalid');
    assert.equal(classifyVerifyError('boom'), 'invalid');
    assert.equal(classifyVerifyError(null), 'invalid');
    assert.equal(classifyVerifyError(undefined), 'invalid');
  });
});

describe('isMagicLinkErrorCode', () => {
  test('accepts every fixed code', () => {
    for (const code of ['invalid', 'expired', 'suspended', 'network', 'link_expired']) {
      assert.equal(isMagicLinkErrorCode(code), true);
    }
  });

  test('rejects arbitrary backend text — the exact bug this closes', () => {
    assert.equal(isMagicLinkErrorCode('Internal Server Error'), false);
    assert.equal(isMagicLinkErrorCode('invalid_or_expired_link'), false);
    assert.equal(isMagicLinkErrorCode('coming_soon'), false);
  });

  test('rejects null and empty string', () => {
    assert.equal(isMagicLinkErrorCode(null), false);
    assert.equal(isMagicLinkErrorCode(''), false);
  });

  test('every fixed code has a display message', () => {
    for (const code of ['invalid', 'expired', 'suspended', 'network', 'link_expired']) {
      assert.equal(typeof MAGIC_LINK_ERROR_MESSAGES[code], 'string');
      assert.ok(MAGIC_LINK_ERROR_MESSAGES[code].length > 0);
    }
  });
});

describe('sessionMatchesEmail', () => {
  test('matches the same email case-insensitively', () => {
    assert.equal(sessionMatchesEmail({ user: { email: 'A@B.com' } }, 'a@b.com'), true);
  });

  test('rejects a signed-out session', () => {
    assert.equal(sessionMatchesEmail({ user: null }, 'a@b.com'), false);
  });

  test('rejects a session signed in as someone else — the stale/wrong-user regression', () => {
    assert.equal(sessionMatchesEmail({ user: { email: 'other@b.com' } }, 'a@b.com'), false);
  });

  test('rejects an empty target email', () => {
    assert.equal(sessionMatchesEmail({ user: { email: 'a@b.com' } }, ''), false);
  });
});

describe('createRunOnce', () => {
  test('a second call for the same key gets the first call’s promise, not a second invocation', async () => {
    let calls = 0;
    const runOnce = createRunOnce();
    const fn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    const [a, b] = await Promise.all([runOnce('token-1', fn), runOnce('token-1', fn)]);
    assert.equal(calls, 1);
    assert.equal(a, b);
  });

  test('two calls for different keys each run', async () => {
    let calls = 0;
    const runOnce = createRunOnce();
    const fn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    await runOnce('token-1', fn);
    await runOnce('token-2', fn);
    assert.equal(calls, 2);
  });

  test('a call made after the first has already settled still reuses it (a later remount)', async () => {
    let calls = 0;
    const runOnce = createRunOnce();
    const fn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    const first = await runOnce('token-1', fn);
    const second = await runOnce('token-1', fn);
    assert.equal(calls, 1);
    assert.equal(first, second);
  });

  test('a rejected first call is also cached — a replayed effect does not retry mid-flight', async () => {
    let calls = 0;
    const runOnce = createRunOnce();
    const fn = () => {
      calls += 1;
      return Promise.reject(new Error('failed'));
    };
    const results = await Promise.allSettled([runOnce('token-1', fn), runOnce('token-1', fn)]);
    assert.equal(calls, 1);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].status, 'rejected');
  });
});
