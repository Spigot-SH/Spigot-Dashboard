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
const { isValidHostname, toHostname, validateChallengeResponse, parseCheckResponse } = await import(
  modulePath
);

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

describe('validateChallengeResponse — regression: partial response must not enter PENDING', () => {
  const validValue = 'x402-verification=abc123';

  test('accepts a complete, well-formed response', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'api.example.com', value: validValue },
    };
    assert.deepEqual(validateChallengeResponse(res), { ok: true });
  });

  test('rejects a missing record name (the regression case)', () => {
    const res = { id: 'v-1', record: { type: 'TXT', value: validValue } };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects an empty record name', () => {
    const res = { id: 'v-1', record: { type: 'TXT', name: '', value: validValue } };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects a record name that is a URL with a path', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'https://api.example.com/v1', value: validValue },
    };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects a record type other than TXT', () => {
    const res = {
      id: 'v-1',
      record: { type: 'CNAME', name: 'api.example.com', value: validValue },
    };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects a value that does not start with x402-verification=', () => {
    const res = {
      id: 'v-1',
      record: { type: 'TXT', name: 'api.example.com', value: 'abc123' },
    };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects a missing verification id', () => {
    const res = { record: { type: 'TXT', name: 'api.example.com', value: validValue } };
    const result = validateChallengeResponse(res);
    assert.equal(result.ok, false);
  });

  test('rejects a missing record entirely', () => {
    const result = validateChallengeResponse({ id: 'v-1' });
    assert.equal(result.ok, false);
  });

  test('rejects null/undefined input', () => {
    assert.equal(validateChallengeResponse(null).ok, false);
    assert.equal(validateChallengeResponse(undefined).ok, false);
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
