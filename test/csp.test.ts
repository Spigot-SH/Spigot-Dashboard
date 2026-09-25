/**
 * Pure-logic tests for `src/lib/csp.ts`.
 *
 * Same runner as test/gatewayUrl.test.ts and test/domainVerification.test.ts: no vitest, no
 * jest as an existing dependency, so per the project's own rule of not adding a dependency to
 * get one, this uses Node's own `--test` runner directly against the plain-TypeScript source
 * file. Run with: `npm test` or `node --experimental-strip-types --test test/*.test.ts`.
 *
 * The module under test is loaded with a dynamic `import()` (module path built from a
 * non-literal expression) rather than a static `import … from '…/csp.ts'`: tsc's
 * `moduleResolution: "bundler"` (tsconfig.json) rejects a static import ending in `.ts`
 * (TS5097) unless `allowImportingTsExtensions` is set project-wide, which this change does not
 * add. Node's ESM loader still needs the real `.ts` extension to resolve the file, so the
 * specifier is built at runtime instead of written as a literal.
 *
 * What this checks is the string the header actually ships, not the live CSP enforcement in a
 * browser — that was checked separately (see src/lib/csp.ts's comment) with a real Razorpay
 * checkout and a real Firebase auth-iframe request against this exact CSP.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/lib/csp', '.ts'].join('');
const { buildContentSecurityPolicy } = await import(modulePath);

describe('buildContentSecurityPolicy', () => {
  test('frame-src contains the Firebase auth domain when it is set', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'spigot-dashboard.firebaseapp.com',
    });
    assert.match(csp, /frame-src[^;]*https:\/\/spigot-dashboard\.firebaseapp\.com/);
  });

  test('frame-src omits a Firebase origin when the auth domain is not set', () => {
    const unset = buildContentSecurityPolicy({});
    const empty = buildContentSecurityPolicy({ firebaseAuthDomain: '' });
    assert.doesNotMatch(unset, /firebaseapp\.com|firebase/);
    assert.doesNotMatch(empty, /firebaseapp\.com|firebase/);
  });

  test('frame-src contains the Razorpay origin', () => {
    const csp = buildContentSecurityPolicy({});
    assert.match(csp, /frame-src[^;]*https:\/\/api\.razorpay\.com/);
  });

  test("frame-ancestors 'none' is still present", () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'spigot-dashboard.firebaseapp.com',
    });
    assert.match(csp, /(^|; )frame-ancestors 'none'(;|$)/);
  });
});

describe('buildContentSecurityPolicy — regression: a malformed auth domain must not widen the policy', () => {
  // The CSP grammar splits a directive's value on whitespace into separate sources and starts a
  // new directive on ";" — a naive string splice trusted the env var to already be one bare
  // hostname. A read-only check against the pre-fix code produced a policy allowing
  // https://evil.example from a value containing a space (Codex round 4, follows up
  // c3805b4+dac9c95+c91b585).

  test('a value with an embedded space does not add the extra origin', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'evil.example spigot-dashboard.firebaseapp.com',
    });
    assert.doesNotMatch(csp, /evil\.example/);
    // The whole malformed value is dropped, not split and half-trusted — the env var as
    // configured is not the one hostname it must be.
    assert.doesNotMatch(csp, /firebaseapp\.com/);
  });

  test('a value carrying a second directive is dropped entirely', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: "x402.firebaseapp.com; script-src 'unsafe-inline'",
    });
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.doesNotMatch(csp, /firebaseapp\.com/);
    // No second "script-src" directive was introduced.
    assert.equal((csp.match(/script-src/g) || []).length, 0);
  });

  test('a value with a comma-separated second host does not add either origin', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'spigot-dashboard.firebaseapp.com,evil.example',
    });
    assert.doesNotMatch(csp, /evil\.example/);
    assert.doesNotMatch(csp, /firebaseapp\.com/);
  });

  test('a bare wildcard is rejected', () => {
    const csp = buildContentSecurityPolicy({ firebaseAuthDomain: '*' });
    assert.doesNotMatch(csp, /frame-src[^;]*\*/);
  });

  test('a value with a scheme or path is rejected', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'https://spigot-dashboard.firebaseapp.com/x',
    });
    assert.doesNotMatch(csp, /firebaseapp\.com/);
  });

  test('a valid hostname is still allowed through unchanged', () => {
    const csp = buildContentSecurityPolicy({
      firebaseAuthDomain: 'spigot-dashboard.firebaseapp.com',
    });
    assert.match(csp, /frame-src[^;]*https:\/\/spigot-dashboard\.firebaseapp\.com(\s|$)/);
  });
});
