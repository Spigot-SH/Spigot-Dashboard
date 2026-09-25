'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/common/Spinner';
import {
  MAGIC_LINK_FRAGMENT_STASH_KEY,
  MAGIC_LINK_MEMORY_STASH_KEY,
  isSuccessfulVerifyResponse,
  resolveCallbackOutcome,
  createRunOnce,
  createLinkAttemptCache,
  type MinimalSession,
} from '../lib/magicLinkFlow';

/**
 * Where a magic-link email points instead of straight at the backend.
 *
 * The token rides in the URL fragment (`#token=...&email=...`), which the browser never sends
 * to any server, so it never lands in an edge or access log — unlike a `?token=` query string.
 * The root layout's `beforeInteractive` script (`src/app/layout.tsx`) moves that fragment into
 * sessionStorage before this page's own bundle, or anything else on the page, can read it; this
 * component reads it from there, POSTs it to the backend exactly once, and only routes into the
 * app once a *refreshed* shared session actually matches the email the link was for. See
 * `src/lib/magicLinkFlow.ts` for the pure pieces this is built from and why each one exists —
 * this file is orchestration only.
 */

// Module-level, not component state: shared by every mount of this component within one page
// load, and keyed by the link's token rather than gated by a single flag — see
// createLinkAttemptCache's and createRunOnce's doc comments in lib/magicLinkFlow.ts. React
// Strict Mode's dev-only double effect and a real remount (routed away from and back to this
// page without a reload) both re-run the effect against the *same* module instance:
// `recoverAttempt` recovers the token/email even after the stash that carried them has already
// been consumed, and `runOnce` shares the first call's promise for that token instead of firing
// a second POST. A second, distinct link opened in the same document gets a fresh token, so
// both recover its own attempt and run their own POST — neither is keyed on "has anything run
// yet", only on the token.
const recoverAttempt = createLinkAttemptCache();
const runOnce = createRunOnce<void>();

export default function MagicLinkCallback() {
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    const stashed = readAndClearStash();
    const memory = readAndClearMemoryStash();
    // Nothing was stashed — either the guard script did not run (a cached HTML shell from
    // before this change), or this is a repeat invocation after the first already consumed both
    // stashes (Strict Mode's double effect, or a remount). Fall back to the live fragment, and
    // clear it here the same way the guard script does when it finds one.
    const liveHash = !stashed && !memory ? window.location.hash : '';
    if (liveHash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }

    // recoverAttempt remembers the last fragment it was given something for, so a repeat
    // invocation that found nothing live still gets the attempt already keyed into `runOnce` —
    // see createLinkAttemptCache's doc comment.
    const parsed = recoverAttempt(stashed || memory || liveHash || null);
    if (!parsed) {
      router.replace('/login?auth_error=invalid');
      return;
    }
    const { token, email } = parsed;

    void runOnce(token, () =>
      authApi.verifyMagicLink(email, token).then(body => {
        if (!isSuccessfulVerifyResponse(body)) {
          throw Object.assign(new Error('Malformed response from the sign-in server'), {
            status: 502,
          });
        }
      }),
    )
      .then(() => finishWithSession(email, refresh, router, null))
      .catch((err: unknown) => finishWithSession(email, refresh, router, err));
  }, [router, refresh]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={24} className="text-muted" label="Signing you in" />
    </div>
  );
}

const readAndClearStash = (): string | null => {
  try {
    const value = window.sessionStorage.getItem(MAGIC_LINK_FRAGMENT_STASH_KEY);
    window.sessionStorage.removeItem(MAGIC_LINK_FRAGMENT_STASH_KEY);
    return value;
  } catch {
    return null;
  }
};

/** The guard script's fallback stash for when `sessionStorage.setItem` threw. */
const readAndClearMemoryStash = (): string | null => {
  const win = window as unknown as Record<string, unknown>;
  const value = win[MAGIC_LINK_MEMORY_STASH_KEY];
  win[MAGIC_LINK_MEMORY_STASH_KEY] = undefined;
  return typeof value === 'string' && value ? value : null;
};

/**
 * Whether the POST above threw or not, the only thing allowed to send this browser into the app
 * is a *freshly refreshed* session that matches the link's email — never the POST's own
 * resolution. Two reasons this is one path instead of a success branch and an error branch:
 *
 * - A successful POST does not mean the shared `AuthProvider` reflects it yet. `refresh()`
 *   re-fetches `/auth/me` on the same cookie the POST just set, so it is the source of truth,
 *   not whatever stale or wrong-user session the provider held before this page loaded — the
 *   regression this change exists to close.
 * - A *failed* POST is not proof nothing happened: a dropped response, a second tab that lost
 *   the race on the single-use token, or Strict Mode's replayed effect can all land here after
 *   the backend already consumed the token and set the cookie. Checking the real session before
 *   showing an error is what keeps that browser from being told a link is invalid when it is
 *   already signed in.
 *
 * The routing decision itself lives in `resolveCallbackOutcome` (lib/magicLinkFlow.ts), so it
 * can be tested without React or `window`; this is orchestration only.
 */
const finishWithSession = (
  email: string,
  refresh: () => Promise<MinimalSession>,
  router: { replace: (href: string) => void },
  verifyError: unknown,
): void => {
  void refresh()
    .catch(() => ({ user: null }) as MinimalSession)
    .then(session => {
      router.replace(resolveCallbackOutcome(session, email, verifyError).redirectTo);
    });
};
