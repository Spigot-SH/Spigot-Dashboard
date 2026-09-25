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
 * The backend's slug format (apis.ts:140-141, POST /: `name.toLowerCase().replace(/[^a-z0-9]+/g,
 * '-') + '-' + Math.random().toString(36).substr(2, 5)`):
 *
 * - The name half collapses every run of non `[a-z0-9]` characters (punctuation, whitespace,
 *   unicode letters that don't reduce to ASCII a-z0-9) into a single hyphen. Punctuation at the
 *   start or end of the name therefore leaves a single leading or trailing hyphen on that half,
 *   and a name with no `[a-z0-9]` character at all (all punctuation, or an unusable name)
 *   collapses to just `-`. Either way it never produces two hyphens in a row by itself.
 * - The suffix half is always appended as a *second*, separate `-`, so a name that already ends
 *   in a hyphen (trailing punctuation) yields a double hyphen right before the suffix, e.g.
 *   "Weather API!" -> `weather-api--abcde`.
 * - `Math.random().toString(36).substr(2, 5)` takes at most 5 base36 characters, but can take
 *   fewer: `substr` only returns what's there, and non-decimal `Number#toString` output isn't
 *   fixed-width, so the suffix is 1-5 lowercase-base36 characters in practice, not always 5.
 *
 * So a real slug is: an optional leading hyphen, zero or more `[a-z0-9]+` groups each followed
 * by a single hyphen (the last of which is allowed to be the mandatory suffix separator with no
 * name group after it — the "everything collapsed" case), then a 1-5 character lowercase-base36
 * suffix. This also still rejects a raw UUID `id` (e.g.
 * `550e8400-e29b-41d4-a716-446655440000`), whose final hyphen-separated segment is 12
 * characters, well past the 5-character cap — so a caller that fell back from `slug` to `id`
 * fails this check instead of producing a URL that 404s.
 */
const SLUG_PATTERN = /^(?:-?(?:[a-z0-9]+-)*[a-z0-9]*)-[a-z0-9]{1,5}$/;

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
 * True when a *stored* endpoint path can ever be matched by the gateway's routing query.
 * gateway.ts:39-44 always rebuilds the incoming request path as `` `/${rawPath}` ``, so the
 * value it compares against the database is guaranteed to start with exactly one `/`.
 * gateway.ts:55-60 then matches on `path = ? OR path = ? OR REPLACE(path, ',', '/') = ?` against
 * that value — a straight equality (plus a comma-to-slash fallback) against the row's `path`
 * column as stored, with no normalization applied to the stored value itself. A stored path
 * that doesn't already start with `/` — including an empty string, which the importer can leave
 * behind instead of running it through the backend's own `cleanPath` (apis.ts:231-236) — can
 * therefore never equal that request path, so the endpoint is permanently unroutable and must
 * not render a URL that will 404.
 */
function isRoutablePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/');
}

/**
 * Builds the gateway URL for a valid slug and a path the gateway can actually route to, or null
 * when the slug is missing/malformed or the path isn't routable (see `isRoutablePath`). Does not
 * consider publish status — callers that must not show a URL for an unpublished API
 * (gateway.ts:48-50) use `buildPublishedGatewayUrl` instead.
 */
export function buildGatewayUrl(origin: string, slug: unknown, path: unknown): string | null {
  if (!isValidSlug(slug)) return null;
  if (!isRoutablePath(path)) return null;
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
