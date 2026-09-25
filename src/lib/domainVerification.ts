/**
 * Pure validation for the domain-verification wizard: no React, no fetch, no other repo
 * modules. Kept dependency-free and self-contained so both the UI
 * (src/components/steps/DomainVerify.tsx, src/components/steps/BasicInfo.tsx) and the Node
 * test runner (test/domainVerification.test.ts) import the exact same logic.
 *
 * Mirrors the backend's own hostname/prefix rules in
 * Spigot-Algorand/backend/src/routes/verification.ts (toHostname, TXT_PREFIX) without importing
 * across repos (AGENTS.md: no cross-repo imports).
 */

/** The backend's TXT_PREFIX (verification.ts). */
export const TXT_VALUE_PREFIX = 'x402-verification=';

/** A bare DNS hostname: no scheme, path, port or query string. */
export function isValidHostname(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    !/[:/?#]/.test(name) &&
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(name)
  );
}

/** Strips scheme, path, port and query so a user-entered URL becomes a bare hostname. */
export function toHostname(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split(/[/?#]/)[0]
    .split(':')[0]
    .toLowerCase();
  return isValidHostname(cleaned) ? cleaned : null;
}

export interface ChallengeRecord {
  type?: unknown;
  name?: unknown;
  value?: unknown;
}

export interface ChallengeResponse {
  id?: unknown;
  record?: ChallengeRecord;
}

export type ChallengeValidation = { ok: true } | { ok: false; error: string };

/**
 * Validates a `/verify/initiate` response before the wizard shows DNS instructions or enters
 * PENDING. A partial response — e.g. a value with no record name — must never put the wizard
 * into PENDING, and a missing/invalid record name must never be replaced with the raw domain
 * the publisher typed in.
 */
export function validateChallengeResponse(
  res: ChallengeResponse | null | undefined,
): ChallengeValidation {
  if (typeof res?.id !== 'string' || res.id.length === 0) {
    return { ok: false, error: 'The server did not return a verification ID.' };
  }
  const record = res.record;
  if (!record || record.type !== 'TXT') {
    return { ok: false, error: 'The server did not return a TXT record to verify.' };
  }
  if (!isValidHostname(record.name)) {
    return { ok: false, error: 'The server did not return a valid DNS host for the TXT record.' };
  }
  if (typeof record.value !== 'string' || !record.value.startsWith(TXT_VALUE_PREFIX)) {
    return { ok: false, error: 'The server did not return a valid verification value.' };
  }
  return { ok: true };
}

export interface CheckResult {
  status: string;
  error?: string;
}

/**
 * Maps a `/verify/check` HTTP response into a typed result, preserving the backend's 410
 * expiry (verification.ts: challenges expire 30 minutes after `/verify/initiate`) instead of
 * collapsing it into a generic thrown error.
 */
export function parseCheckResponse(
  httpStatus: number,
  body: { status?: unknown; error?: unknown } | null | undefined,
): CheckResult {
  const error = typeof body?.error === 'string' ? body.error : undefined;
  if (httpStatus === 410) {
    return { status: 'EXPIRED', error };
  }
  return { status: typeof body?.status === 'string' ? body.status : 'UNKNOWN', error };
}
