'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/common/Spinner';
import {
  MAGIC_LINK_FRAGMENT_STASH_KEY,
  parseMagicLinkFragment,
  isSuccessfulVerifyResponse,
  classifyVerifyError,
  sessionMatchesEmail,
  createRunOnce,
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
// load. React Strict Mode runs this effect's body twice per mount in dev (`started` is the same
// closed-over variable both times, so the second run no-ops); a real remount — routed away from
// and back to this page without a reload — creates a new component instance but not a new
// module, so `runOnce` below still has the first mount's promise cached and the POST to
// `/auth/magic-link/callback` still only goes out once per page load.
let started = false;
const runOnce = createRunOnce<void>();

export default function MagicLinkCallback() {
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    if (started) return;
    started = true;

    const stashed = readAndClearStash();
    // Nothing was stashed — the guard script did not run (a cached HTML shell from before this
    // change is the only case this happens in production). Fall back to the live fragment and
    // clear it here instead, same as the guard script does.
    const hash = stashed ?? window.location.hash;
    if (!stashed && window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }

    const parsed = parseMagicLinkFragment(hash || '');
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
      if (sessionMatchesEmail(session, email)) {
        router.replace('/?signed_in=1');
        return;
      }
      const code = verifyError === null ? 'invalid' : classifyVerifyError(verifyError);
      const emailParam = code === 'coming_soon' ? `&email=${encodeURIComponent(email)}` : '';
      router.replace(`/login?auth_error=${code}${emailParam}`);
    });
};
