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

  test('rejects a malformed slug (uppercase, no suffix, bad chars)', () => {
    assert.equal(isValidSlug('Weather-Data-Api'), false);
    assert.equal(isValidSlug('weather-data-api'), false);
    assert.equal(isValidSlug('weather_data_api-x7g2p'), false);
    assert.equal(isValidSlug('weather-data-api-x7g'), false);
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

  test('builds the same URL for a path without a leading slash', () => {
    assert.equal(
      buildGatewayUrl(ORIGIN, 'weather-x7g2p', 'forecast'),
      'https://spigot.sh/x402/weather-x7g2p/forecast',
    );
  });

  test('returns null for a missing slug', () => {
    assert.equal(buildGatewayUrl(ORIGIN, undefined, '/forecast'), null);
    assert.equal(buildGatewayUrl(ORIGIN, '', '/forecast'), null);
  });

  test('returns null for a malformed slug, including the id fallback', () => {
    assert.equal(buildGatewayUrl(ORIGIN, '550e8400-e29b-41d4-a716-446655440000', '/forecast'), null);
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
      buildPublishedGatewayUrl(ORIGIN, '550e8400-e29b-41d4-a716-446655440000', '/forecast', 'PUBLISHED'),
      null,
    );
  });
});
