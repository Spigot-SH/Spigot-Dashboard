import { BASE_URL } from './client';

/**
 * The one credentialed JSON request every API module makes.
 *
 * `api/auth.ts` and `api/credits.ts` each carried their own near-identical copy, which is how
 * a fix lands in one of them and not the other. This is that function, once.
 *
 * The session lives in an httpOnly cookie, so `credentials` must ride along with every call.
 */
export const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
  } catch {
    // fetch only rejects when the request never completed: offline, DNS, connection refused.
    throw Object.assign(new Error('Could not reach the server. Check your connection.'), {
      status: 0,
    });
  }

  const text = await res.text();
  let body: unknown;
  let wasJson = true;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON means this did not come from the API. In development that is almost always the
    // dev server answering for a backend that is not running, and "Internal Server Error" on
    // its own sends people looking for a bug in the page instead.
    wasJson = false;
    body = { error: text };
  }

  if (!res.ok) {
    if (!wasJson) {
      throw Object.assign(
        new Error(
          `The API did not respond (${res.status}). The backend may not be running behind this origin.`,
        ),
        { status: res.status, body },
      );
    }
    const fields =
      body && typeof body === 'object' ? (body as { error?: unknown; message?: unknown }) : {};
    const reported = typeof fields.error === 'string' ? fields.error : fields.message;
    throw Object.assign(
      new Error(typeof reported === 'string' ? reported : `Request failed (${res.status})`),
      { status: res.status, body },
    );
  }
  return body as T;
};
