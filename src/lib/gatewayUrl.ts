/**
 * Pure gateway-URL building for the onboarding wizard and the APIs table: no React, no fetch,
 * no other repo modules. Kept dependency-free and self-contained so both the UI
 * (src/components/steps/ApiInfo.tsx, src/components/steps/X402Preview.tsx,
 * src/components/dashboard/ApisView.tsx) and the Node test runner
 * (test/gatewayUrl.test.ts) import the exact same logic.
 *
 * Mirrors the backend's own slug format and path normalization in
 * Spigot-Algorand/backend/src/routes/apis.ts (slug generation, cleanPath) and its gateway
 * routing/publish gate in Spigot-Algorand/backend/src/routes/gateway.ts (apis.ts:48-50: 404
 * unless the slug resolves to a PUBLISHED api) without importing across repos (AGENTS.md: no
 * cross-repo imports).
 */

/**
 * The backend's slug format (apis.ts POST /: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
 * '-' + Math.random().toString(36).substr(2, 5)`): lowercase alphanumeric segments joined by
 * single hyphens, ending in a 5-character lowercase-base36 suffix segment. This also rejects a
 * raw UUID `id` (e.g. `550e8400-e29b-41d4-a716-446655440000`), whose final hyphen-separated
 * segment is 12 characters, not 5 — so a caller that fell back from `slug` to `id` fails this
 * check instead of producing a URL that 404s.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{5}$/;

/** A non-empty string matching the backend's slug format. */
export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

/**
 * Normalizes an endpoint path to exactly one leading slash, matching `cleanPath` in
 * Spigot-Algorand/backend/src/routes/apis.ts:215-220 — the same normalization the backend
 * applies before it stores the path, so manual entry (`forecast`) and an already-slashed path
 * (`/forecast`) both build the URL the backend actually serves.
 */
export function normalizeEndpointPath(path: unknown): string {
  if (typeof path !== 'string' || path.trim().length === 0) return '/';
  let formatted = path.trim().replace(/,/g, '/');
  if (!formatted.startsWith('/')) formatted = '/' + formatted;
  return formatted;
}

/**
 * Builds the gateway URL for a valid slug and path, or null when the slug is missing or
 * malformed. Does not consider publish status — callers that must not show a URL for an
 * unpublished API (gateway.ts:48-50) use `buildPublishedGatewayUrl` instead.
 */
export function buildGatewayUrl(
  origin: string,
  slug: unknown,
  path: unknown,
): string | null {
  if (!isValidSlug(slug)) return null;
  return `${origin}/x402/${slug}${normalizeEndpointPath(path)}`;
}

/**
 * Builds the gateway URL for an already-registered endpoint row, suppressing it unless the
 * API's status is exactly `'PUBLISHED'`. gateway.ts:48-50 returns 404 for any other status
 * (DRAFT, TESTING, READY, SUSPENDED) or an unrecognized one — so an unknown status (the field
 * missing from the API response, `undefined`) fails closed the same as a known non-published
 * status, rather than assuming the row is safe to link.
 */
export function buildPublishedGatewayUrl(
  origin: string,
  slug: unknown,
  path: unknown,
  status: unknown,
): string | null {
  if (status !== 'PUBLISHED') return null;
  return buildGatewayUrl(origin, slug, path);
}
