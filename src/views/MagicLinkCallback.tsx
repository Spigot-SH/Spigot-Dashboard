'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/common/Spinner';
import {
  MAGIC_LINK_FRAGMENT_STASH_KEY,
  MAGIC_LINK_MEMORY_STASH_KEY,
  isSuccessfulVerifyResponse,
  resolveCallbackOutcome,
  buildConfirmPrompt,
  createRunOnce,
  createLinkAttemptCache,
  type MinimalSession,
  type MagicLinkFragment,
} from '../lib/magicLinkFlow';

/**
 * Where a magic-link email points instead of straight at the backend.
 *
 * The token rides in the URL fragment (`#token=...&email=...`), which the browser never sends
 * to any server, so it never lands in an edge or access log — unlike a `?token=` query string.
 * The root layout's `beforeInteractive` script (`src/app/layout.tsx`) moves that fragment into
 * sessionStorage before this page's own bundle, or anything else on the page, can read it; this
 * component reads it from there, but — unlike the version Codex round 3 rejected — never POSTs
 * it on its own.
 *
 * Reading and even holding a valid token is not the same as proof the person in front of this
 * browser is the one who asked for it: an attacker can get their *own* valid link opened in a
 * victim's browser (an auto-navigated redirect, an `<img>`-style load, a link shared as
 * "click this"), and a page that POSTs on load would sign that browser into the attacker's
 * account with no action from the victim at all — replacing whatever session was already there.
 * So this page only ever parses the fragment on mount; the POST to
 * `POST /auth/magic-link/callback` fires from nowhere except an explicit click on the "Sign in
 * as `<email>`?" screen's Continue button, rendered below once the fragment is parsed and the
 * shared session is known. If a different account is already signed in, that screen says so
 * before the click can replace it. See `src/lib/magicLinkFlow.ts` for the pure pieces this is
 * built from (`buildConfirmPrompt` in particular) and why each one exists — this file is
 * orchestration only.
 */

// Module-level, not component state: shared by every mount of this component within one page
// load, and keyed by the link's token rather than gated by a single flag — see
// createLinkAttemptCache's and createRunOnce's doc comments in lib/magicLinkFlow.ts. React
// Strict Mode's dev-only double effect and a real remount (routed away from and back to this
// page without a reload) both re-run the effect against the *same* module instance:
// `recoverAttempt` recovers the token/email even after the stash that carried them has already
// been consumed, and `runOnce` shares the first call's promise for that token instead of firing
// a second POST from a double-click on Continue. A second, distinct link opened in the same
// document gets a fresh token, so both recover its own attempt and run their own POST — neither
// is keyed on "has anything run yet", only on the token.
const recoverAttempt = createLinkAttemptCache();
const runOnce = createRunOnce<void>();

type Status = 'parsing' | 'confirm' | 'submitting';

export default function MagicLinkCallback() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const [status, setStatus] = useState<Status>('parsing');
  const [attempt, setAttempt] = useState<MagicLinkFragment | null>(null);

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
    // see createLinkAttemptCache's doc comment. Parsing never POSTs anything on its own.
    const parsed = recoverAttempt(stashed || memory || liveHash || null);
    if (!parsed) {
      router.replace('/login?auth_error=invalid');
      return;
    }
    setAttempt(parsed);
    setStatus('confirm');
  }, [router]);

  const handleConfirm = () => {
    if (!attempt) return;
    setStatus('submitting');
    const { token, email } = attempt;
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
  };

  // Wait for the shared session to load before showing the confirm screen: `buildConfirmPrompt`
  // needs the *real* currently-signed-in account to warn accurately about replacing it, not the
  // brief window where the provider has not fetched `/auth/me` yet.
  if (status !== 'confirm' || !attempt || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner
          size={24}
          className="text-muted"
          label={status === 'submitting' ? 'Signing you in' : undefined}
        />
      </div>
    );
  }

  const prompt = buildConfirmPrompt(user, attempt.email);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 text-center shadow-sm">
        {prompt.differentAccount && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            You are signed in as {prompt.currentEmail}. Continuing replaces that session.
          </p>
        )}
        <h1 className="mb-1 text-lg font-semibold text-main">Sign in as {attempt.email}?</h1>
        <p className="mb-5 text-sm text-muted">Only continue if you opened this link yourself.</p>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-transparent bg-main px-4 py-3 text-sm font-medium text-bg hover:opacity-90"
        >
          Continue
        </button>
      </div>
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
 *   the race on the single-use token, or a double-click on Continue can all land here after
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
