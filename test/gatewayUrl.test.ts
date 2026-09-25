/**
 * Pure-logic tests for `src/lib/gatewayUrl.ts`.
 *
 * Same runner as test/domainVerification.test.ts: no vitest, no jest as an existing dependency,
 * so per the project's own rule of not adding a dependency to get one, this uses Node's own
 * `--test` runner directly against the plain-TypeScript source file (no JSX, no React, no other
 * repo imports). Run with: `npm test` or
 * `node --experimental-strip-types --test test/*.test.ts`.
 *
 * The module under test is loaded with a dynamic `import()` (module path built from a
 * non-literal expression) rather than a static `import … from '…/gatewayUrl.ts'`: tsc's
 * `moduleResolution: "bundler"` (tsconfig.json) rejects a static import ending in `.ts` (TS5097)
 * unless `allowImportingTsExtensions` is set project-wide, which this change does not add.
 * Node's ESM loader still needs the real `.ts` extension to resolve the file, so the specifier
 * is built at runtime instead of written as a literal.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/lib/gatewayUrl', '.ts'].join('');
const { isValidSlug, normalizeEndpointPath, buildGatewayUrl, buildPublishedGatewayUrl } =
  await import(modulePath);

const ORIGIN = 'https://spigot.sh';

/**
 * Runs the backend's own slug generation logic (apis.ts:140-141:
 * `name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + suffix`) against a candidate `name`,
 * with a caller-supplied `suffix` standing in for `Math.random().toString(36).substr(2, 5)` so
 * the tests can exercise "unusual" suffix lengths without depending on actual randomness.
 */
function backendSlug(name: string, suffix: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + suffix;
}

describe('isValidSlug', () => {
  test('accepts the backend slug format (kebab name + 5-char suffix)', () => {
    assert.equal(isValidSlug('weather-data-api-x7g2p'), true);
    assert.equal(isValidSlug('weather-x7g2p'), true);
  });

  test('rejects a missing slug', () => {
    assert.equal(isValidSlug(undefined), false);
    assert.equal(isValidSlug(null), false);
  });

  test('rejects an empty slug', () => {
    assert.equal(isValidSlug(''), false);
  });

  test('rejects a raw UUID (the removed id fallback)', () => {
    assert.equal(isValidSlug('550e8400-e29b-41d4-a716-446655440000'), false);
  });

  test('rejects a malformed slug (uppercase, bad chars, no suffix segment at all)', () => {
    assert.equal(isValidSlug('Weather-Data-Api'), false);
    assert.equal(isValidSlug('weather_data_api-x7g2p'), false);
    assert.equal(isValidSlug('weather data api-x7g2p'), false);
    // No hyphen anywhere: there is no possible name/suffix split.
    assert.equal(isValidSlug('weatherdataapi'), false);
    // A suffix longer than the 5-character cap `substr(2, 5)` can ever produce.
    assert.equal(isValidSlug('weather-data-api-abcdef'), false);
    // A dangling separator with nothing after it (would need Math.random() to return exactly
    // 0, which `substr` would turn into a 0-length suffix): no suffix characters to show.
    assert.equal(isValidSlug('weather-data-api-'), false);
  });

  test('accepts suffixes shorter than 5 characters (substr(2, 5) is not fixed-width)', () => {
    // Math.random().toString(36).substr(2, 5) only returns as many characters as the number's
    // base-36 expansion has past index 2 — that can be fewer than 5.
    assert.equal(isValidSlug(backendSlug('Weather', 'x7g')), true);
    assert.equal(isValidSlug(backendSlug('Weather', 'x7')), true);
    assert.equal(isValidSlug(backendSlug('Weather', 'x')), true);
  });

  test('accepts slugs from names with leading/trailing punctuation (double hyphen before suffix)', () => {
    // The example from the round-3 rejection: "Weather API!" -> weather-api--abcde.
    assert.equal(isValidSlug(backendSlug('Weather API!', 'abcde')), true);
    assert.equal(isValidSlug('weather-api--abcde'), true);
    assert.equal(isValidSlug(backendSlug('!Weather API', 'abcde')), true);
    assert.equal(isValidSlug(backendSlug('!Weather API!', 'abcde')), true);
  });

  test('accepts slugs from unicode names (non-ASCII letters collapse like punctuation)', () => {
    assert.equal(isValidSlug(backendSlug('Café Météo', 'abcde')), true);
    assert.equal(isValidSlug(backendSlug('日本語 API', 'abcde')), true);
    assert.equal(isValidSlug(backendSlug('😀 Emoji API', 'abcde')), true);
  });

  test('accepts slugs from a name that is empty after stripping (all punctuation)', () => {
    assert.equal(isValidSlug(backendSlug('!!!', 'abcde')), true);
    assert.equal(isValidSlug(backendSlug('', 'abcde')), true);
    assert.equal(isValidSlug('--abcde'), true);
    assert.equal(isValidSlug('-abcde'), true);
  });

  test('accepts a slug from a very long name', () => {
    assert.equal(isValidSlug(backendSlug('x'.repeat(300) + '!', 'abcde')), true);
  });

  test('rejects non-string values', () => {
    assert.equal(isValidSlug(42), false);
    assert.equal(isValidSlug({}), false);
  });
});

describe('normalizeEndpointPath', () => {
  test('adds a leading slash to a path without one (manual entry)', () => {
    assert.equal(normalizeEndpointPath('forecast'), '/forecast');
  });

  test('leaves a path with a leading slash unchanged', () => {
    assert.equal(normalizeEndpointPath('/forecast'), '/forecast');
  });

  test('does not double the slash', () => {
    assert.equal(normalizeEndpointPath('/forecast'), '/forecast');
    assert.notEqual(normalizeEndpointPath('/forecast'), '//forecast');
  });

  test('defaults to "/" for a missing or empty path', () => {
    assert.equal(normalizeEndpointPath(undefined), '/');
    assert.equal(normalizeEndpointPath(null), '/');
    assert.equal(normalizeEndpointPath(''), '/');
    assert.equal(normalizeEndpointPath('   '), '/');
  });
});

describe('buildGatewayUrl', () => {
  test('builds the URL for a valid slug and a leading-slash path', () => {
    assert.equal(
      buildGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast'),
      'https://spigot.sh/x402/weather-x7g2p/forecast',
    );
  });

  test('builds the URL for a path containing commas (gateway.ts REPLACE fallback)', () => {
    assert.equal(
      buildGatewayUrl(ORIGIN, 'weather-x7g2p', '/weather,forecast'),
      'https://spigot.sh/x402/weather-x7g2p/weather/forecast',
    );
  });

  test('returns null for a missing slug', () => {
    assert.equal(buildGatewayUrl(ORIGIN, undefined, '/forecast'), null);
    assert.equal(buildGatewayUrl(ORIGIN, '', '/forecast'), null);
  });

  test('returns null for a malformed slug, including the id fallback', () => {
    assert.equal(
      buildGatewayUrl(ORIGIN, '550e8400-e29b-41d4-a716-446655440000', '/forecast'),
      null,
    );
  });

  test("returns null for a stored path without a leading slash: it can never match gateway.ts:39-44's computed `/${rawPath}` request path", () => {
    // Unlike manual form entry (normalizeEndpointPath adds the slash before the backend's own
    // cleanPath stores it), this is an already-stored value: adding a slash here would show a
    // URL for a row the gateway can never actually route to.
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', 'forecast'), null);
  });

  test('returns null for an empty stored path (the importer can leave this in place of cleanPath\'s "/" default)', () => {
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', ''), null);
  });

  test('returns null for a malformed stored path (whitespace-only, no leading slash)', () => {
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', '   '), null);
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', 'weather,forecast'), null);
  });

  test('returns null for a missing or non-string stored path', () => {
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', undefined), null);
    assert.equal(buildGatewayUrl(ORIGIN, 'weather-x7g2p', null), null);
  });
});

describe('buildPublishedGatewayUrl — draft and published rows', () => {
  test('returns the URL for a published row with a valid slug', () => {
    assert.equal(
      buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast', 'PUBLISHED'),
      'https://spigot.sh/x402/weather-x7g2p/forecast',
    );
  });

  test('returns null for a draft row even with a valid slug', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast', 'DRAFT'), null);
  });

  test('returns null for any other non-published status', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast', 'TESTING'), null);
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast', 'SUSPENDED'), null);
  });

  test('fails closed when status is unknown (field missing from the response)', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '/forecast', undefined), null);
  });

  test('returns null for a published row with an interrupted-onboarding slug (missing/malformed)', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, undefined, '/forecast', 'PUBLISHED'), null);
    assert.equal(
      buildPublishedGatewayUrl(
        ORIGIN,
        '550e8400-e29b-41d4-a716-446655440000',
        '/forecast',
        'PUBLISHED',
      ),
      null,
    );
  });

  test('returns null for a published row whose stored path is empty (importer left it blank)', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '', 'PUBLISHED'), null);
  });

  test('returns null for a published row whose stored path is missing a leading slash', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', 'forecast', 'PUBLISHED'), null);
  });

  test('returns null for a published row whose stored path is malformed (whitespace-only)', () => {
    assert.equal(buildPublishedGatewayUrl(ORIGIN, 'weather-x7g2p', '   ', 'PUBLISHED'), null);
  });

  test('accepts a slug with leading/trailing-punctuation-derived hyphens for a published row', () => {
    // "Weather API!" -> weather-api--abcde (the round-3 regression this fixes).
    assert.equal(
      buildPublishedGatewayUrl(ORIGIN, 'weather-api--abcde', '/forecast', 'PUBLISHED'),
      'https://spigot.sh/x402/weather-api--abcde/forecast',
    );
  });
});
