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
  resolveCallbackOutcome,
  createRunOnce,
  createLinkAttemptCache,
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

  // Codex round 3, item 4 (magicLinkFlow.ts:127-133): `/auth/me` is cast to `AuthUser` with no
  // runtime check, so a malformed or partial response can hand this a `user.email` that is not
  // a string. Calling `.toLowerCase()` on it used to throw, and since this runs inside a
  // `.then()` with no `.catch()` after it in MagicLinkCallback.tsx, the throw silently killed
  // the promise chain and left the callback on the spinner forever instead of routing to an
  // error — never throwing here is what closes that.
  test('a non-string email does not throw and reads as no match', () => {
    assert.doesNotThrow(() => {
      assert.equal(sessionMatchesEmail({ user: { email: 123 } } as never, 'a@b.com'), false);
    });
  });

  test('a null email on the user object does not throw and reads as no match', () => {
    assert.doesNotThrow(() => {
      assert.equal(sessionMatchesEmail({ user: { email: null } } as never, 'a@b.com'), false);
    });
  });

  test('a user object missing the email field entirely does not throw', () => {
    assert.doesNotThrow(() => {
      assert.equal(sessionMatchesEmail({ user: {} } as never, 'a@b.com'), false);
    });
  });

  test('a non-object user (a partial /auth/me body) does not throw', () => {
    assert.doesNotThrow(() => {
      assert.equal(sessionMatchesEmail({ user: 'not-an-object' } as never, 'a@b.com'), false);
    });
  });
});

describe('resolveCallbackOutcome — the decision half of finishWithSession, tested through the callback logic', () => {
  test('a verified session matching the link email routes into the app', () => {
    const outcome = resolveCallbackOutcome({ user: { email: 'a@b.com' } }, 'a@b.com', null);
    assert.equal(outcome.redirectTo, '/?signed_in=1');
  });

  test('a signed-out refreshed session (the stale-/auth/me regression) routes to an error, not into the app', () => {
    const outcome = resolveCallbackOutcome({ user: null }, 'a@b.com', null);
    assert.equal(outcome.redirectTo, '/login?auth_error=invalid');
  });

  test('a refreshed session for the previous user (the wrong-user regression) routes to an error', () => {
    const outcome = resolveCallbackOutcome({ user: { email: 'other@b.com' } }, 'a@b.com', null);
    assert.equal(outcome.redirectTo, '/login?auth_error=invalid');
  });

  test('a malformed refreshed session (non-string email) never throws and routes to an error, never a spinner', () => {
    assert.doesNotThrow(() => {
      const outcome = resolveCallbackOutcome({ user: { email: 42 } } as never, 'a@b.com', null);
      assert.equal(outcome.redirectTo, '/login?auth_error=invalid');
    });
  });

  test('a failed POST whose refresh still matches (a lost response after the backend already consumed the token) still signs in', () => {
    const verifyError = Object.assign(new Error('x'), { status: 0 });
    const outcome = resolveCallbackOutcome({ user: { email: 'a@b.com' } }, 'a@b.com', verifyError);
    assert.equal(outcome.redirectTo, '/?signed_in=1');
  });

  test('a failed POST whose refresh does not match carries the classified error code', () => {
    const verifyError = Object.assign(new Error('x'), {
      status: 403,
      body: { error: 'account_suspended' },
    });
    const outcome = resolveCallbackOutcome({ user: null }, 'a@b.com', verifyError);
    assert.equal(outcome.redirectTo, '/login?auth_error=suspended');
  });
});

describe('createLinkAttemptCache — Codex round 3, item 3: keyed by token, not a module-level flag', () => {
  test('a fresh fragment on the first call is parsed and remembered', () => {
    const recover = createLinkAttemptCache();
    const attempt = recover('#token=tok-1&email=a%40b.com');
    assert.deepEqual(attempt, { token: 'tok-1', email: 'a@b.com' });
  });

  test('effect replay (Strict Mode double invoke): a second call with nothing fresh reuses the first attempt', () => {
    const recover = createLinkAttemptCache();
    const first = recover('#token=tok-1&email=a%40b.com');
    const replay = recover(null); // the stash was already consumed by the first call
    assert.deepEqual(replay, first);
  });

  test('remount: a call with nothing fresh, well after the first, still gets the settled attempt', () => {
    const recover = createLinkAttemptCache();
    const first = recover('#token=tok-1&email=a%40b.com');
    const remount = recover(null);
    assert.deepEqual(remount, first);
  });

  test('a second, distinct link is processed — not blocked by the first attempt', () => {
    const recover = createLinkAttemptCache();
    const firstLink = recover('#token=tok-1&email=a%40b.com');
    const secondLink = recover('#token=tok-2&email=c%40d.com');
    assert.deepEqual(firstLink, { token: 'tok-1', email: 'a@b.com' });
    assert.deepEqual(secondLink, { token: 'tok-2', email: 'c@d.com' });
    assert.notDeepEqual(firstLink, secondLink);
  });

  test('two simultaneous opens for the same token both resolve the same attempt', () => {
    const recover = createLinkAttemptCache();
    const a = recover('#token=tok-1&email=a%40b.com');
    const b = recover('#token=tok-1&email=a%40b.com');
    assert.deepEqual(a, b);
  });

  test('no fragment ever seen (no stash, no memory fallback, no live hash) is a genuine invalid link', () => {
    const recover = createLinkAttemptCache();
    assert.equal(recover(null), null);
  });
});

describe('The callback flow end to end (createLinkAttemptCache + createRunOnce + resolveCallbackOutcome), through the exact composition MagicLinkCallback.tsx uses', () => {
  const runAttempt = async (
    recover: ReturnType<typeof createLinkAttemptCache>,
    runOnce: ReturnType<typeof createRunOnce>,
    freshFragment: string | null,
    verify: (email: string, token: string) => Promise<unknown>,
    refresh: () => Promise<{ user: { email: string } | null }>,
  ) => {
    const parsed = recover(freshFragment);
    if (!parsed) return { redirectTo: '/login?auth_error=invalid' };
    const { token, email } = parsed;
    let verifyError: unknown = null;
    await runOnce(token, () =>
      verify(email, token).then(body => {
        if (!isSuccessfulVerifyResponse(body)) {
          throw Object.assign(new Error('Malformed response from the sign-in server'), {
            status: 502,
          });
        }
      }),
    ).catch((err: unknown) => {
      verifyError = err;
    });
    const session = await refresh().catch(() => ({ user: null }));
    return resolveCallbackOutcome(session, email, verifyError);
  };

  test('effect replay does not fire a second POST and lands on the same outcome', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    let posts = 0;
    const verify = async () => {
      posts += 1;
      return { ok: true };
    };
    const refresh = async () => ({ user: { email: 'a@b.com' } });

    const first = await runAttempt(
      recover,
      runOnce,
      '#token=tok-1&email=a%40b.com',
      verify,
      refresh,
    );
    const replay = await runAttempt(recover, runOnce, null, verify, refresh);

    assert.equal(posts, 1);
    assert.deepEqual(first, replay);
    assert.equal(first.redirectTo, '/?signed_in=1');
  });

  test('a remount well after settling reaches the same, already-decided outcome', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    const verify = async () => ({ ok: true });
    const refresh = async () => ({ user: { email: 'a@b.com' } });

    await runAttempt(recover, runOnce, '#token=tok-1&email=a%40b.com', verify, refresh);
    const remount = await runAttempt(recover, runOnce, null, verify, refresh);

    assert.equal(remount.redirectTo, '/?signed_in=1');
  });

  test('a second link in the same document is processed on its own, not stuck behind the first', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    let posts = 0;
    const verify = async () => {
      posts += 1;
      return { ok: true };
    };
    const refresh = async () => ({ user: { email: 'second@b.com' } });

    await runAttempt(recover, runOnce, '#token=tok-1&email=first%40b.com', verify, async () => ({
      user: { email: 'first@b.com' },
    }));
    const second = await runAttempt(
      recover,
      runOnce,
      '#token=tok-2&email=second%40b.com',
      verify,
      refresh,
    );

    assert.equal(posts, 2);
    assert.equal(second.redirectTo, '/?signed_in=1');
  });

  test('two simultaneous opens for the same token fire one POST and both settle to the same outcome', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    let posts = 0;
    const verify = async () => {
      posts += 1;
      return { ok: true };
    };
    const refresh = async () => ({ user: { email: 'a@b.com' } });

    const [a, b] = await Promise.all([
      runAttempt(recover, runOnce, '#token=tok-1&email=a%40b.com', verify, refresh),
      runAttempt(recover, runOnce, '#token=tok-1&email=a%40b.com', verify, refresh),
    ]);

    assert.equal(posts, 1);
    assert.deepEqual(a, b);
  });

  test('a lost POST response (fetch never completed) still signs in once the refresh confirms it', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    const verify = async () => {
      throw Object.assign(new Error('Could not reach the server.'), { status: 0 });
    };
    // The backend consumed the token and set the cookie despite the dropped response.
    const refresh = async () => ({ user: { email: 'a@b.com' } });

    const outcome = await runAttempt(
      recover,
      runOnce,
      '#token=tok-1&email=a%40b.com',
      verify,
      refresh,
    );

    assert.equal(outcome.redirectTo, '/?signed_in=1');
  });

  test('a lost POST response with no matching session ends in a clear network error, not a stuck spinner', async () => {
    const recover = createLinkAttemptCache();
    const runOnce = createRunOnce();
    const verify = async () => {
      throw Object.assign(new Error('Could not reach the server.'), { status: 0 });
    };
    const refresh = async () => ({ user: null });

    const outcome = await runAttempt(
      recover,
      runOnce,
      '#token=tok-1&email=a%40b.com',
      verify,
      refresh,
    );

    assert.equal(outcome.redirectTo, '/login?auth_error=network');
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
