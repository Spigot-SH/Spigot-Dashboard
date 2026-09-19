/**
 * Read a message off an unknown thrown value.
 *
 * TypeScript types a `catch` binding as `unknown`, because anything can be thrown. Writing
 * `catch (e: any)` silences that at the cost of losing every check inside the handler. This
 * narrows once, in one place, so call sites stay type-safe.
 *
 * Mirrors `backend/src/services/errors.ts`; the two are deliberately separate because the
 * workspaces do not share a build.
 */
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

/** The parsed JSON body `api/client.ts` and `api/auth.ts` attach to a failed request. */
interface ApiErrorBody {
  error?: unknown;
  message?: unknown;
  reason?: unknown;
  details?: unknown;
}

/**
 * Best available message for a failed API call.
 *
 * The backend returns its useful text in the response body — `error`, `reason` or `details` —
 * while `Error.message` is often just "Request failed (502)". This prefers the body, then
 * falls back to the thrown message, then to the caller's default.
 */
export const apiErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (error && typeof error === 'object' && 'body' in error) {
    const body = (error as { body?: unknown }).body as ApiErrorBody | undefined;
    if (body && typeof body === 'object') {
      if (typeof body.error === 'string' && typeof body.reason === 'string' && body.reason) {
        return `${body.error}: ${body.reason}`;
      }
      if (typeof body.error === 'string' && typeof body.details === 'string' && body.details) {
        return `${body.error}: ${body.details}`;
      }
      for (const key of ['message', 'error', 'reason', 'details'] as const) {
        const value = body[key];
        if (typeof value === 'string' && value) return value;
      }
    }
  }
  return errorMessage(error, fallback);
};
