/**
 * Pure-logic tests for `src/views/dashboardGates.ts` — the Codex round-2 rejection of Dashboard
 * 10c90b0+969f99e / backend bf82ebe (local/security-fixes/judge/f26dr2.q.out):
 *
 *   "src/views/Dashboard.tsx:171-175,280-301 skips the stats fetch for a locked provider but
 *   still requires non-null stats to render. A fresh locked provider can remain on 'Loading
 *   Dashboard' without an unlock control." — `shouldShowLoadingSpinner`.
 *
 *   "src/views/Dashboard.tsx:101-104,257-263,345-349. A locked user can open the paid MCP
 *   tutorial from Connectors without the confirmed unlock. Test a direct locked Connectors
 *   route." — `canOpenTutorial`.
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`),
 * which strips TypeScript types but does not transform JSX; `dashboardGates.ts` has no JSX, so
 * it loads directly here the same way `providerAccessGate.ts` does in
 * `test/providerAccessGate.test.ts`. Run with `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/views/dashboardGates', '.ts'].join('');
const { shouldShowLoadingSpinner, canOpenTutorial, shouldShowProviderAccessLockedCard } =
  await import(modulePath);

describe('shouldShowLoadingSpinner', () => {
  test('still loading (auth not resolved yet): always show the spinner', () => {
    assert.equal(shouldShowLoadingSpinner(true, false, false), true);
    assert.equal(shouldShowLoadingSpinner(true, true, false), true);
    assert.equal(shouldShowLoadingSpinner(true, false, true), true);
  });

  test('a cold direct provider route where the session resolves as locked before stats arrive: no spinner, show the locked card', () => {
    assert.equal(shouldShowLoadingSpinner(false, false, true), false);
  });

  test('not blocked, no stats yet: keep showing the spinner', () => {
    assert.equal(shouldShowLoadingSpinner(false, false, false), true);
  });

  test('not blocked, stats loaded: stop showing the spinner', () => {
    assert.equal(shouldShowLoadingSpinner(false, true, false), false);
  });

  test('blocked, stats somehow present anyway: still no spinner', () => {
    assert.equal(shouldShowLoadingSpinner(false, true, true), false);
  });
});

describe('canOpenTutorial', () => {
  test('a direct locked Connectors route (tutorialUnlocked false) must not open the paid tutorial', () => {
    assert.equal(canOpenTutorial(false), false);
  });

  test('an unlocked account may open the tutorial', () => {
    assert.equal(canOpenTutorial(true), true);
  });
});

describe('shouldShowProviderAccessLockedCard', () => {
  test('not blocked: never show the locked card, on any section', () => {
    assert.equal(shouldShowProviderAccessLockedCard(false, 'overview'), false);
    assert.equal(shouldShowProviderAccessLockedCard(false, 'explore'), false);
  });

  for (const section of ['apis', 'analytics', 'overview']) {
    test(`blocked on a gated section (${section}): show the locked card`, () => {
      assert.equal(shouldShowProviderAccessLockedCard(true, section), true);
    });
  }

  for (const section of ['explore', 'connectors', 'settings']) {
    test(`blocked with no publisher yet, on an always-reachable section (${section}): no locked card`, () => {
      // Regression (f40d.txt): the old gate also checked `needsAccount`, so a blocked account
      // with no publisher yet got the locked card here too. This function takes no
      // `needsAccount` parameter at all now — only the section decides.
      assert.equal(shouldShowProviderAccessLockedCard(true, section), false);
    });
  }
});
