'use client';

import { errorMessage } from '../lib/errors';
import React, { useEffect, useState } from 'react';
import { Mail, KeyRound, ArrowLeft, ArrowRight, CheckCircle, Link2, Sparkles } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { authApi } from '../api/auth';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/common/Spinner';
import { auth, googleProvider } from '../lib/firebase';

/**
 * The local-only shortcut past sign-in, and the three things that keep it local.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const DEV_BYPASS_MARKER = 'spigot-dev-sign-in';
/** `.test` is reserved by RFC 2606, so this can never be a real mailbox. */
const DEV_EMAIL = 'dev@localhost.test';

type Mode = 'choose' | 'magic-sent' | 'otp-code';

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
 * Every way into an account: Google (via Firebase), a magic link, a six-digit code.
 */
export const SignInPanel: React.FC<SignInPanelProps> = ({ onSignedIn }) => {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'magic' | 'otp' | 'verify' | 'dev' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const [comingSoonEmail, setComingSoonEmail] = useState<string | null>(null);

  useEffect(() => {
    setIsLocal(LOCAL_HOSTS.has(window.location.hostname));
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth_error') === 'coming_soon') {
        setComingSoonEmail(params.get('email') || 'This account');
      }
    } catch {
      // ignore in environments without window.location
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setBusy('google');
    setError(null);
    setComingSoonEmail(null);
    let attemptedEmail: string | null = null;
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      attemptedEmail = userCredential.user.email || null;
      const oauthCredential = GoogleAuthProvider.credentialFromResult(userCredential);
      const tokenToSend = oauthCredential?.idToken || (await userCredential.user.getIdToken());
      await authApi.signInWithGoogle(tokenToSend);
      await refresh();
      onSignedIn();
    } catch (err: unknown) {
      const errObj = err as {
        code?: string;
        message?: string;
        status?: number;
        body?: { comingSoon?: boolean; email?: string };
      };
      if (errObj?.code === 'auth/popup-closed-by-user') {
        // User closed popup without signing in
        return;
      }
      if (auth.currentUser) {
        await auth.signOut().catch(() => null);
      }
      const msg = errorMessage(err, 'Google sign-in failed');
      const isComingSoon =
        errObj?.body?.comingSoon ||
        errObj?.status === 403 ||
        /coming soon/i.test(msg) ||
        /whitelist/i.test(msg);

      if (isComingSoon) {
        setComingSoonEmail(errObj?.body?.email || attemptedEmail || 'This Google account');
        setError(null);
        return;
      }
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleMagicLink = async () => {
    setBusy('magic');
    setError(null);
    setDevLink(null);
    setComingSoonEmail(null);
    try {
      const result = await authApi.requestMagicLink(email);
      setMode('magic-sent');
      if (result.channel === 'console') {
        setNotice('Email delivery is not configured. The link was printed to the backend console.');
        if (result.devLink) setDevLink(result.devLink);
      }
    } catch (err: unknown) {
      const errObj = err as {
        status?: number;
        body?: { comingSoon?: boolean; email?: string };
      };
      const msg = errorMessage(err, 'Could not send the sign-in link');
      const isComingSoon =
        errObj?.body?.comingSoon ||
        errObj?.status === 403 ||
        /coming soon/i.test(msg) ||
        /whitelist/i.test(msg);

      if (isComingSoon) {
        setComingSoonEmail(errObj?.body?.email || email);
        setError(null);
        return;
      }
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const handleOtp = async () => {
    setBusy('otp');
    setError(null);
    setComingSoonEmail(null);
    try {
      const result = await authApi.requestOtp(email);
      setMode('otp-code');
      if (result.channel === 'console') {
        setNotice('Email delivery is not configured. The code was printed to the backend console.');
        if (result.devCode) setCode(result.devCode);
      }
    } catch (err: unknown) {
      const errObj = err as {
        status?: number;
        body?: { comingSoon?: boolean; email?: string };
      };
      const msg = errorMessage(err, 'Could not send the code');
      const isComingSoon =
        errObj?.body?.comingSoon ||
        errObj?.status === 403 ||
        /coming soon/i.test(msg) ||
        /whitelist/i.test(msg);

      if (isComingSoon) {
        setComingSoonEmail(errObj?.body?.email || email);
        setError(null);
        return;
      }
      setError(msg);
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
    setComingSoonEmail(null);
    try {
      await authApi.verifyOtp(email, code);
      await refresh();
      onSignedIn();
    } catch (err: unknown) {
      const errObj = err as {
        status?: number;
        body?: { comingSoon?: boolean; email?: string };
      };
      const msg = errorMessage(err, 'That code is not valid');
      const isComingSoon =
        errObj?.body?.comingSoon ||
        errObj?.status === 403 ||
        /coming soon/i.test(msg) ||
        /whitelist/i.test(msg);

      if (isComingSoon) {
        setComingSoonEmail(errObj?.body?.email || email);
        setMode('choose');
        setError(null);
        return;
      }
      setError(msg);
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
      {comingSoonEmail && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles size={12} className="text-amber-400" /> Coming Soon
            </span>
            <button
              type="button"
              onClick={() => setComingSoonEmail(null)}
              className="cursor-pointer border-0 bg-transparent text-xs text-muted hover:text-main p-0"
            >
              Dismiss
            </button>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-main">
            Spigot is coming soon for this account!
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            <span className="font-mono text-main font-medium">{comingSoonEmail}</span> is not on our early access whitelist yet. We are rolling out access gradually and will open to all users soon.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setComingSoonEmail(null);
                setEmail('');
                setMode('choose');
              }}
              className="cursor-pointer border-0 bg-transparent text-xs text-amber-400 hover:text-amber-300 underline p-0 font-medium"
            >
              Try another account
            </button>
          </div>
        </div>
      )}

      {mode !== 'choose' && (
        <button
          type="button"
          onClick={() => {
            setMode('choose');
            setNotice(null);
            setError(null);
            setComingSoonEmail(null);
          }}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-main bg-transparent border-0 cursor-pointer p-0 mb-4"
        >
          <ArrowLeft size={13} /> Back
        </button>
      )}

      {mode === 'choose' && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy !== null}
            className={`${quietButton} mb-3`}
          >
            {busy === 'google' ? <Spinner size={16} /> : <GoogleMark />} Continue with Google
          </button>

          {/* Disabled on purpose until backend has GitHub route */}
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
              onChange={e => {
                setEmail(e.target.value);
                if (comingSoonEmail) setComingSoonEmail(null);
              }}
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
              <Link2 size={16} aria-hidden="true" />
              Email me a sign-in link
            </button>

            <button
              type="button"
              onClick={handleOtp}
              disabled={!emailValid || busy !== null}
              className={quietButton}
            >
              {busy === 'otp' ? <Spinner size={16} /> : <KeyRound size={16} aria-hidden="true" />}
              Send me a 6-digit code
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && isLocal && (
            <div className="mt-5 text-center">
              <button
                type="button"
                data-test-marker={DEV_BYPASS_MARKER}
                onClick={handleDevSignIn}
                disabled={busy !== null}
                className="bg-transparent border-0 text-xs text-muted hover:text-main cursor-pointer underline p-0"
              >
                {busy === 'dev'
                  ? 'Starting local session...'
                  : `Skip sign-in as ${emailValid ? email : DEV_EMAIL}`}
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'magic-sent' && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-main font-medium">
            <CheckCircle size={18} className="text-emerald-500" />
            Check your email
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            We sent a sign-in link to <span className="text-main font-medium">{email}</span>. Open
            it in this browser.
          </p>
          {devLink && (
            <a
              href={devLink}
              className={`${buttonClass} border-transparent bg-main text-bg hover:opacity-90 no-underline`}
            >
              Dev mode: open link now
            </a>
          )}
        </div>
      )}

      {mode === 'otp-code' && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-main font-medium">
            <KeyRound size={18} className="text-main" />
            Enter verification code
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            We sent a 6-digit code to <span className="text-main font-medium">{email}</span>.
          </p>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className={`${inputClass} text-center tracking-widest text-lg font-mono mb-3`}
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={code.length !== 6 || busy !== null}
            className={`${buttonClass} border-transparent bg-main text-bg hover:opacity-90`}
          >
            {busy === 'verify' ? <Spinner size={16} /> : 'Verify and sign in'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-400">
          {notice}
        </div>
      )}
    </>
  );
};

export default SignInPanel;
