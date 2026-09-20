'use client';

import { errorMessage } from '../lib/errors';
import React, { useEffect, useRef, useState } from 'react';
import { Mail, KeyRound, ArrowLeft, ArrowRight, CheckCircle, Link2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/common/Spinner';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * The local-only shortcut past sign-in, and the three things that keep it local.
 *
 * 1. `NODE_ENV` is compared inline at the branch itself, so the bundler folds it to `false` and
 *    drops the whole block. Reading it into a module-level const instead is not enough — the
 *    first version of this did that, and `S1.5-dev-bypass` found the marker in
 *    `.next/static/chunks` of a production build.
 * 2. The hostname must be a loopback name, checked in the browser at run time.
 * 3. The shortcut has no power of its own. It asks the backend for a magic link and can only
 *    continue if the backend hands the link back — which `routes/auth.ts` does solely when
 *    `!config.IS_PRODUCTION` and no mail provider is configured. Against a real deployment the
 *    button exists in no bundle, and would get nothing if it did.
 *
 * `DEV_BYPASS_MARKER` is the string `scripts/security-review.sh` greps for in `.next/static`.
 * If any of this ever survives a production build, that check fails the review.
 *
 * It is one quiet line under the form, not a panel. It is a developer convenience, and giving
 * it the weight of a warning block made it the loudest thing on the sign-in screen.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const DEV_BYPASS_MARKER = 'spigot-dev-sign-in';
/** `.test` is reserved by RFC 2606, so this can never be a real mailbox. */
const DEV_EMAIL = 'dev@localhost.test';

type Mode = 'choose' | 'magic-sent' | 'otp-code';

/** The Google Identity Services surface this panel actually uses. */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: { theme?: string; size?: string; width?: number; text?: string },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

/** GitHub's mark. Single path, `currentColor`, so it takes the button's own text colour. */
const GitHubMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/** Google's four-colour G, as their sign-in branding requires on a "Continue with" button. */
const GoogleMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
);

interface SignInPanelProps {
  /** Called once the session exists. The modal closes; the login page navigates. */
  onSignedIn: () => void;
}

/**
 * Every way into an account: Google, a magic link, a six-digit code.
 *
 * Lives on its own so the modal and the full-page `/login` are the same form, not two that
 * drift. Both mount it only while it is visible, so closing one resets its state by unmounting
 * rather than by an effect that has to remember every field.
 */
export const SignInPanel: React.FC<SignInPanelProps> = ({ onSignedIn }) => {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'magic' | 'otp' | 'verify' | 'dev' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  // Read in an effect, not during render: the server has no hostname, and guessing one would
  // make the HTML disagree with the first client paint.
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(LOCAL_HOSTS.has(window.location.hostname));
  }, []);

  // Google Identity Services renders its own button and hands back an ID token,
  // which the backend verifies against Google's public keys.
  useEffect(() => {
    if (mode !== 'choose' || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const render = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            setError(null);
            await authApi.signInWithGoogle(response.credential);
            await refresh();
            onSignedIn();
          } catch (err) {
            setError(errorMessage(err, 'Google sign-in failed'));
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [mode, refresh, onSignedIn]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleMagicLink = async () => {
    setBusy('magic');
    setError(null);
    setDevLink(null);
    try {
      const result = await authApi.requestMagicLink(email);
      setMode('magic-sent');
      if (result.channel === 'console') {
        setNotice('Email delivery is not configured. The link was printed to the backend console.');
        if (result.devLink) setDevLink(result.devLink);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not send the sign-in link'));
    } finally {
      setBusy(null);
    }
  };

  const handleOtp = async () => {
    setBusy('otp');
    setError(null);
    try {
      const result = await authApi.requestOtp(email);
      setMode('otp-code');
      if (result.channel === 'console') {
        setNotice('Email delivery is not configured. The code was printed to the backend console.');
        if (result.devCode) setCode(result.devCode);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not send the code'));
    } finally {
      setBusy(null);
    }
  };

  /** Uses the backend's own dev channel. It cannot invent a session; only the backend can. */
  const handleDevSignIn = async () => {
    setBusy('dev');
    setError(null);
    try {
      const result = await authApi.requestMagicLink(emailValid ? email : DEV_EMAIL);
      if (!result.devLink) {
        setError(
          'The backend did not return a dev link. It only does that when it is not running in production and has no mail provider configured.',
        );
        return;
      }
      // The callback sets the session cookie and redirects back with ?signed_in=1.
      window.location.href = result.devLink;
    } catch (err) {
      setError(errorMessage(err, 'Could not start a local session'));
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    setBusy('verify');
    setError(null);
    try {
      await authApi.verifyOtp(email, code);
      await refresh();
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err, 'That code is not valid'));
    } finally {
      setBusy(null);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-panel px-3 py-3 text-sm text-main outline-none focus:border-main';
  const buttonClass =
    'w-full flex items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed';
  const quietButton = `${buttonClass} border-border bg-panel text-main hover:bg-panel-hover`;

  return (
    <>
      {mode !== 'choose' && (
        <button
          type="button"
          onClick={() => {
            setMode('choose');
            setNotice(null);
            setError(null);
          }}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-main bg-transparent border-0 cursor-pointer p-0 mb-4"
        >
          <ArrowLeft size={13} /> Back
        </button>
      )}

      {mode === 'choose' && (
        <>
          {GOOGLE_CLIENT_ID ? (
            <div className="mb-3 flex justify-center">
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <button
              type="button"
              disabled
              title="Google sign-in is not configured for this deployment"
              className={`${quietButton} mb-3`}
            >
              <GoogleMark /> Continue with Google
            </button>
          )}

          {/* Disabled on purpose, and it stays that way until the backend serves
              `POST /auth/github`. `Spigot-Algorand/backend/src/routes/auth.ts` implements
              magic-link, otp, otp/verify and google, and nothing else, so this button has
              nowhere to send anyone yet. It is here because the layout is agreed; wiring it
              is a change in that repo, not this one. */}
          <button
            type="button"
            disabled
            title="GitHub sign-in is not available yet. The backend has no GitHub route."
            className={`${quietButton} mb-3`}
          >
            <GitHubMark /> Continue with GitHub
          </button>

          <div className="relative mb-3">
            <Mail
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && emailValid && busy === null) void handleMagicLink();
              }}
              placeholder="you@example.com"
              aria-label="Email address"
              className={`${inputClass} pl-10`}
            />
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={!emailValid || busy !== null}
            className={`${buttonClass} mb-3 border-transparent bg-main text-bg hover:opacity-90`}
          >
            {busy === 'magic' ? <Spinner size={16} /> : null}
            Continue
            {busy === 'magic' ? null : <ArrowRight size={16} />}
          </button>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={!emailValid || busy !== null}
              className={quietButton}
            >
              {busy === 'magic' ? <Spinner size={16} /> : <Link2 size={16} />}
              Email me a sign-in link
            </button>
            <button
              type="button"
              onClick={handleOtp}
              disabled={!emailValid || busy !== null}
              className={quietButton}
            >
              {busy === 'otp' ? <Spinner size={16} /> : <KeyRound size={16} />}
              Send me a 6-digit code
            </button>
          </div>
        </>
      )}

      {mode === 'magic-sent' && (
        <div className="text-center py-4">
          <CheckCircle size={32} className="mx-auto mb-3 text-main" />
          <h2 className="text-lg font-semibold text-main mb-1">Check your email</h2>
          <p className="text-sm text-muted">
            We sent a sign-in link to <span className="text-main">{email}</span>. Open it in this
            browser.
          </p>
          {devLink && (
            <a
              href={devLink}
              className="mt-4 inline-block rounded-md bg-main px-4 py-2 text-xs font-semibold text-bg no-underline hover:opacity-90"
            >
              Dev mode: sign in without the email
            </a>
          )}
        </div>
      )}

      {mode === 'otp-code' && (
        <>
          <h2 className="text-lg font-semibold text-main mb-1">Enter your code</h2>
          <p className="text-sm text-muted mb-5">
            Sent to <span className="text-main">{email}</span>
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            className={`${inputClass} mb-4 text-center text-2xl tracking-[0.5em] font-mono`}
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={code.length !== 6 || busy !== null}
            className={`${buttonClass} border-transparent bg-main text-bg hover:opacity-90`}
          >
            {busy === 'verify' && <Spinner size={16} />}
            Verify and sign in
          </button>
        </>
      )}

      {process.env.NODE_ENV !== 'production' && isLocal && mode === 'choose' && (
        <div className="mt-5 text-center">
          <button
            type="button"
            data-testid={DEV_BYPASS_MARKER}
            onClick={handleDevSignIn}
            disabled={busy !== null}
            className="cursor-pointer border-0 bg-transparent text-xs text-muted underline hover:text-main disabled:opacity-40"
          >
            {busy === 'dev'
              ? 'Starting a local session…'
              : `Skip sign-in as ${emailValid ? email : DEV_EMAIL}`}
          </button>
        </div>
      )}

      {notice && (
        <p className="mt-4 text-xs text-muted border border-border rounded-md px-3 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 text-xs text-error border border-error/40 bg-error/10 rounded-md px-3 py-2"
        >
          {error}
        </p>
      )}
    </>
  );
};

export default SignInPanel;
