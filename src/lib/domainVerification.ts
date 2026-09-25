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

/** The backend's challenge length: `crypto.randomBytes(32).toString('hex')` (verification.ts). */
export const TXT_VALUE_HEX_LENGTH = 64;

/** The exact shape of a value the backend can have issued — prefix plus 64 lowercase hex
 *  characters, nothing more and nothing less. An empty or truncated `x402-verification=` must
 *  fail this, since the backend's own `/verify/check` compares the DNS record byte-for-byte
 *  against `${TXT_PREFIX}${challenge}`. */
const TXT_VALUE_RE = new RegExp(`^${TXT_VALUE_PREFIX}[0-9a-f]{${TXT_VALUE_HEX_LENGTH}}$`);

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

/** Case-insensitive hostname equality that also ignores a trailing DNS root dot
 *  ("api.example.com." — some resolvers and registrars return the FQDN form). */
export function sameHostname(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const strip = (s: string) => s.toLowerCase().replace(/\.$/, '');
  return strip(a) === strip(b);
}

/**
 * Validates a `/verify/initiate` response before the wizard shows DNS instructions or enters
 * PENDING. A partial response — e.g. a value with no record name — must never put the wizard
 * into PENDING, and a missing/invalid record name must never be replaced with the raw domain
 * the publisher typed in. `requestedHostname` is the domain the wizard actually asked the
 * backend to verify: a TXT record for any other host must be rejected even if it is otherwise
 * well-formed, and the value must be exactly the backend's own challenge format — an empty or
 * truncated `x402-verification=` is not "close enough".
 */
export function validateChallengeResponse(
  res: ChallengeResponse | null | undefined,
  requestedHostname: string,
): ChallengeValidation {
  if (typeof res?.id !== 'string' || res.id.length === 0) {
    return { ok: false, error: 'The server did not return a verification ID.' };
  }
  const record = res.record;
  if (!record || record.type !== 'TXT') {
    return { ok: false, error: 'The server did not return a TXT record to verify.' };
  }
  // Strip a trailing DNS root dot before the format check too, so a well-formed FQDN
  // ("api.example.com.") is not rejected as an invalid hostname before it even reaches the
  // comparison below.
  const recordName = typeof record.name === 'string' ? record.name.replace(/\.$/, '') : record.name;
  if (!isValidHostname(recordName)) {
    return { ok: false, error: 'The server did not return a valid DNS host for the TXT record.' };
  }
  if (!sameHostname(recordName, requestedHostname)) {
    return {
      ok: false,
      error: 'The server returned a TXT record for a different domain than requested.',
    };
  }
  if (typeof record.value !== 'string' || !TXT_VALUE_RE.test(record.value)) {
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

export type InitiationPhase = 'LOADING' | 'READY' | 'ERROR';

/**
 * The wizard's challenge-initiation state. Kept as one object so a single pure reducer can
 * decide, on every `/verify/initiate` response, whether that response is still the one the UI
 * is waiting for.
 */
export interface InitiationState {
  phase: InitiationPhase;
  challenge: string;
  recordName: string;
  verificationId: string;
  errorMessage: string;
  requestId: number;
}

export type InitiationOutcome =
  | { ok: true; challenge: string; recordName: string; verificationId: string }
  | { ok: false; error: string };

/** The state before any `/verify/initiate` request has been sent — mount renders this as loading. */
export function initialInitiationState(): InitiationState {
  return {
    phase: 'LOADING',
    challenge: '',
    recordName: '',
    verificationId: '',
    errorMessage: '',
    requestId: 0,
  };
}

/**
 * Begins a new initiation attempt. The mount effect, a manual Retry click, and the automatic
 * re-request after a 410 all call this. It bumps `requestId`, so a response
 * `applyInitiationOutcome` later receives for an *earlier* id — including one still in flight
 * when this call started — is recognised as stale and dropped, even if that earlier request
 * resolves after this one does.
 */
export function startInitiation(state: InitiationState): InitiationState {
  return {
    phase: 'LOADING',
    challenge: '',
    recordName: '',
    verificationId: '',
    errorMessage: '',
    requestId: state.requestId + 1,
  };
}

/**
 * Applies one `/verify/initiate` attempt's outcome. `requestId` must be the id `startInitiation`
 * returned for *this* attempt; if the state has since moved on to a newer one (another
 * `startInitiation` ran first — an overlapping retry, or a fast manual retry racing the mount
 * effect), the outcome is discarded so a stale response can never overwrite a newer challenge,
 * and a newer error can never be replaced by an older one arriving late.
 */
export function applyInitiationOutcome(
  state: InitiationState,
  requestId: number,
  outcome: InitiationOutcome,
): InitiationState {
  if (requestId !== state.requestId) return state;
  if (outcome.ok) {
    return {
      ...state,
      phase: 'READY',
      challenge: outcome.challenge,
      recordName: outcome.recordName,
      verificationId: outcome.verificationId,
      errorMessage: '',
    };
  }
  return {
    ...state,
    phase: 'ERROR',
    challenge: '',
    recordName: '',
    verificationId: '',
    errorMessage: outcome.error,
  };
}
