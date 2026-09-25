/**
 * Pure-logic tests for `src/lib/domainVerification.ts`.
 *
 * This repo has no test runner (no vitest, no jest as an existing dependency), so per the
 * project's own rule of not adding a dependency to get one, this uses Node's own `--test`
 * runner directly against the plain-TypeScript source file (no JSX, no React, no other repo
 * imports) — Node 22.18+/23+ strips TypeScript types natively, so
 * `node --experimental-strip-types --test test/*.test.ts` runs this with zero new dependencies.
 * Run with: `npm test` (see package.json) or
 * `node --experimental-strip-types --test test/*.test.ts`.
 *
 * The module under test is loaded with a dynamic `import()` (module path built from a
 * non-literal expression) rather than a static `import … from '…/domainVerification.ts'`: tsc's
 * `moduleResolution: "bundler"` (tsconfig.json) rejects a static import ending in `.ts`
 * (TS5097) unless `allowImportingTsExtensions` is set project-wide, which this change does not
 * add. Node's ESM loader still needs the real `.ts` extension to resolve the file, so the
 * specifier is built at runtime instead of written as a literal.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/lib/domainVerification', '.ts'].join('');
const {
  isValidHostname,
  toHostname,
  sameHostname,
  validateChallengeResponse,
  parseCheckResponse,
  initialInitiationState,
  startInitiation,
  applyInitiationOutcome,
} = await import(modulePath);

describe('isValidHostname', () => {
  test('accepts a bare hostname', () => {
    assert.equal(isValidHostname('api.example.com'), true);
  });

  test('rejects a URL with a scheme', () => {
    assert.equal(isValidHostname('https://api.example.com'), false);
  });

  test('rejects a hostname with a path', () => {
    assert.equal(isValidHostname('api.example.com/v1'), false);
  });

  test('rejects a hostname with a port', () => {
    assert.equal(isValidHostname('api.example.com:8080'), false);
  });

  test('rejects empty string', () => {
    assert.equal(isValidHostname(''), false);
  });

  test('rejects non-string values', () => {
    assert.equal(isValidHostname(undefined), false);
    assert.equal(isValidHostname(null), false);
    assert.equal(isValidHostname(42), false);
  });
});

describe('toHostname', () => {
  test('passes through a bare hostname', () => {
    assert.equal(toHostname('api.example.com'), 'api.example.com');
  });

  test('strips a scheme and path', () => {
    assert.equal(toHostname('https://api.example.com/v1'), 'api.example.com');
  });

  test('strips a port', () => {
    assert.equal(toHostname('api.example.com:8080'), 'api.example.com');
  });

  test('returns null for a value with no valid hostname', () => {
    assert.equal(toHostname('not a domain'), null);
    assert.equal(toHostname(''), null);
  });
});

describe('sameHostname', () => {
  test('is case-insensitive', () => {
    assert.equal(sameHostname('API.Example.com', 'api.example.com'), true);
  });

  test('ignores a trailing DNS root dot', () => {
    assert.equal(sameHostname('api.example.com.', 'api.example.com'), true);
    assert.equal(sameHostname('api.example.com', 'api.example.com.'), true);
  });

  test('rejects a different hostname', () => {
    assert.equal(sameHostname('evil.example.com', 'api.example.com'), false);
  });

  test('rejects non-string input', () => {
    assert.equal(sameHostname(undefined, 'api.example.com'), false);
    assert.equal(sameHostname('api.example.com', null), false);
  });
});

describe('validateChallengeResponse — regression: partial response must not enter PENDING', () => {
  // The backend's own value format: TXT_VALUE_PREFIX + crypto.randomBytes(32).toString('hex')
  // (Spigot-Algorand/backend/src/routes/verification.ts) — 64 lowercase hex characters.
  const HEX64 = 'ab'.repeat(32);
  const validValue = `x402-verification=${HEX64}`;
  const domain = 'api.example.com';

  test('accepts a complete, well-formed response', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: validValue },
    };
    assert.deepEqual(validateChallengeResponse(res, domain), { ok: true });
  });

  test('accepts a record name that differs only by case and a trailing dot', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'API.Example.com.', value: validValue },
    };
    assert.deepEqual(validateChallengeResponse(res, domain), { ok: true });
  });

  test('rejects a TXT record for a different hostname than requested', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'evil.example.com', value: validValue },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a subdomain that is not the exact hostname requested', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'www.api.example.com', value: validValue },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a missing record name (the regression case)', () => {
    const res = { id: 'v-1', record: { type: 'TXT', value: validValue } };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects an empty record name', () => {
    const res = { id: 'v-1', record: { type: 'TXT', name: '', value: validValue } };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a record name that is a URL with a path', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'https://api.example.com/v1', value: validValue },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a record type other than TXT', () => {
    const res = {
      id: 'v-1',
      record: { type: 'CNAME', name: domain, value: validValue },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a value that does not start with x402-verification=', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: HEX64 },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects an empty value — bare "x402-verification=" is not a challenge', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: 'x402-verification=' },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a value that is too short to be the backend challenge', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: 'x402-verification=abc123' },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a value with the right length but non-hex characters', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: `x402-verification=${'z'.repeat(64)}` },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a value with extra trailing characters after the hex challenge', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: domain, value: `${validValue}extra` },
    };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a missing verification id', () => {
    const res = { record: { type: 'TXT', name: domain, value: validValue } };
    const result = validateChallengeResponse(res, domain);
    assert.equal(result.ok, false);
  });

  test('rejects a missing record entirely', () => {
    const result = validateChallengeResponse({ id: 'v-1' }, domain);
    assert.equal(result.ok, false);
  });

  test('rejects null/undefined input', () => {
    assert.equal(validateChallengeResponse(null, domain).ok, false);
    assert.equal(validateChallengeResponse(undefined, domain).ok, false);
  });
});

describe('parseCheckResponse — 410 expiry', () => {
  test('maps HTTP 410 to an EXPIRED status, keeping the backend error message', () => {
    const result = parseCheckResponse(410, {
      status: 'EXPIRED',
      error: 'Challenge expired — start again',
    });
    assert.deepEqual(result, { status: 'EXPIRED', error: 'Challenge expired — start again' });
  });

  test('maps HTTP 410 to EXPIRED even without a body', () => {
    const result = parseCheckResponse(410, {});
    assert.equal(result.status, 'EXPIRED');
  });

  test('passes through a normal VERIFIED response', () => {
    const result = parseCheckResponse(200, { status: 'VERIFIED' });
    assert.deepEqual(result, { status: 'VERIFIED', error: undefined });
  });
});

describe('initiation retry state machine — regression: a 410 must never dead-end on a disabled Check button', () => {
  const okOutcome = {
    ok: true,
    challenge: 'x402-verification=' + 'ab'.repeat(32),
    recordName: 'api.example.com',
    verificationId: 'v-1',
  };

  test('starts in LOADING with no challenge yet', () => {
    const state = initialInitiationState();
    assert.equal(state.phase, 'LOADING');
    assert.equal(state.challenge, '');
    assert.equal(state.requestId, 0);
  });

  test('a successful outcome moves to READY and carries the challenge', () => {
    const started = startInitiation(initialInitiationState());
    const next = applyInitiationOutcome(started, started.requestId, okOutcome);
    assert.equal(next.phase, 'READY');
    assert.equal(next.challenge, okOutcome.challenge);
    assert.equal(next.recordName, okOutcome.recordName);
    assert.equal(next.verificationId, okOutcome.verificationId);
    assert.equal(next.errorMessage, '');
  });

  test('a failed outcome moves to ERROR with a retryable message, not a dead end', () => {
    const started = startInitiation(initialInitiationState());
    const next = applyInitiationOutcome(started, started.requestId, {
      ok: false,
      error: 'Failed to initiate verification',
    });
    assert.equal(next.phase, 'ERROR');
    assert.equal(next.challenge, '');
    assert.equal(next.errorMessage, 'Failed to initiate verification');
  });

  test('expiry (410) followed by a timeout on the automatic re-initiate ends in ERROR, not stuck LOADING', () => {
    // A verified-so-far READY state, then checkVerification sees EXPIRED and calls
    // initiateVerification again — which this time times out.
    const state = applyInitiationOutcome(startInitiation(initialInitiationState()), 1, okOutcome);
    assert.equal(state.phase, 'READY');

    const reinitiated = startInitiation(state);
    assert.equal(reinitiated.phase, 'LOADING');
    assert.equal(reinitiated.challenge, ''); // old challenge is gone, not shown stale

    const timedOut = applyInitiationOutcome(reinitiated, reinitiated.requestId, {
      ok: false,
      error: 'Failed to initiate verification',
    });
    assert.equal(timedOut.phase, 'ERROR');
    assert.equal(timedOut.challenge, '');
    assert.equal(timedOut.errorMessage, 'Failed to initiate verification');
  });

  test('retry after reload: a fresh mount, then a failed attempt, then Retry succeeds', () => {
    let state = initialInitiationState(); // simulates a page reload
    let started = startInitiation(state);
    state = applyInitiationOutcome(started, started.requestId, {
      ok: false,
      error: 'network error',
    });
    assert.equal(state.phase, 'ERROR');

    // User presses Retry.
    started = startInitiation(state);
    state = applyInitiationOutcome(started, started.requestId, okOutcome);
    assert.equal(state.phase, 'READY');
    assert.equal(state.challenge, okOutcome.challenge);
  });

  test('overlapping requests: only the latest request wins', () => {
    const first = startInitiation(initialInitiationState()); // requestId 1
    const second = startInitiation(first); // requestId 2, supersedes the first before it resolves
    assert.equal(second.requestId, 2);
    assert.equal(second.phase, 'LOADING');

    // The first (stale) request resolves after the second one has already started.
    const afterStaleFirst = applyInitiationOutcome(second, first.requestId, okOutcome);
    assert.equal(afterStaleFirst, second); // dropped entirely — state is unchanged
    assert.equal(afterStaleFirst.phase, 'LOADING');

    // The second (latest) request resolves and is applied.
    const afterSecond = applyInitiationOutcome(afterStaleFirst, second.requestId, okOutcome);
    assert.equal(afterSecond.phase, 'READY');
  });

  test('a stale response must never overwrite a newer challenge', () => {
    const first = startInitiation(initialInitiationState()); // requestId 1
    const secondReady = applyInitiationOutcome(startInitiation(first), 2, okOutcome); // req 2 wins first
    assert.equal(secondReady.phase, 'READY');
    assert.equal(secondReady.challenge, okOutcome.challenge);

    // The stale first request now resolves with a *different* challenge — must be ignored.
    const staleOutcome = {
      ok: true as const,
      challenge: 'x402-verification=' + 'cd'.repeat(32),
      recordName: 'api.example.com',
      verificationId: 'v-stale',
    };
    const after = applyInitiationOutcome(secondReady, first.requestId, staleOutcome);
    assert.deepEqual(after, secondReady);
    assert.equal(after.challenge, okOutcome.challenge);
  });

  test('a stale error response must never clobber a newer, already-ready challenge', () => {
    const first = startInitiation(initialInitiationState());
    const secondReady = applyInitiationOutcome(startInitiation(first), 2, okOutcome);
    assert.equal(secondReady.phase, 'READY');

    const after = applyInitiationOutcome(secondReady, first.requestId, {
      ok: false,
      error: 'stale timeout',
    });
    assert.equal(after.phase, 'READY');
    assert.equal(after.challenge, okOutcome.challenge);
  });
});
