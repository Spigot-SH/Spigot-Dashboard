'use client';

import { errorMessage } from '../lib/errors';
import React, { useEffect, useRef, useState } from 'react';
import { Mail, KeyRound, ArrowLeft, CheckCircle, Zap } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/common/Spinner';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type Mode = 'choose' | 'magic-sent' | 'otp-code';

/** The Google Identity Services surface this modal actually uses. */
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

const SignInModal: React.FC = () => {
  const { signInOpen, closeSignIn, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'magic' | 'otp' | 'verify' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signInOpen) {
      setMode('choose');
      setCode('');
      setError(null);
      setNotice(null);
      setDevLink(null);
    }
  }, [signInOpen]);

  // Google Identity Services renders its own button and hands back an ID token,
  // which the backend verifies against Google's public keys.
  useEffect(() => {
    if (!signInOpen || mode !== 'choose' || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const render = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            setError(null);
            await authApi.signInWithGoogle(response.credential);
            await refresh();
            closeSignIn();
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
  }, [signInOpen, mode, refresh, closeSignIn]);

  if (!signInOpen) return null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleMagicLink = async () => {
    setBusy('magic');
    setError(null);
    setDevLink(null);
    try {
      const result = await authApi.requestMagicLink(email);
      setMode('magic-sent');
      if (result.channel === 'console') {
        if (result.devLink) {
          setDevLink(result.devLink);
          setNotice('Email delivery is not configured — use the direct sign-in button below.');
        } else {
          setNotice(
            'Email delivery is not configured — the link was printed to the backend console.',
          );
        }
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
        if (result.devCode) {
          setCode(result.devCode);
          setNotice('Testnet mode: verifying code automatically...');
          try {
            await authApi.verifyOtp(email, result.devCode);
            await refresh();
            closeSignIn();
            return;
          } catch {
            setNotice('Code auto-filled. Click Verify & Sign in below.');
          }
        } else {
          setNotice(
            'Email delivery is not configured — the code was printed to the backend console.',
          );
        }
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not send the code'));
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
      closeSignIn();
    } catch (err) {
      setError(errorMessage(err, 'That code is not valid'));
    } finally {
      setBusy(null);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-md bg-bg border border-border text-main text-sm outline-none focus:border-main';
  const buttonClass =
    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={closeSignIn}
    >
      <div
        className="w-full max-w-[400px] rounded-xl border border-border bg-panel p-6"
        onClick={e => e.stopPropagation()}
      >
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
            <h2 className="text-lg font-semibold text-main mb-1">Sign in</h2>
            <p className="text-sm text-muted mb-5">
              A wallet is created and funded for you automatically. You never handle keys or ALGO.
            </p>

            {GOOGLE_CLIENT_ID ? (
              <div ref={googleButtonRef} className="flex justify-center mb-5" />
            ) : (
              <p className="text-xs text-muted border border-border rounded-md px-3 py-2 mb-5">
                Google sign-in is unavailable — set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and{' '}
                <code>GOOGLE_CLIENT_ID</code>.
              </p>
            )}

            <div className="flex items-center gap-3 mb-5">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[0.7rem] uppercase tracking-wide text-muted">
                or with email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className={`${inputClass} mb-3`}
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={!emailValid || busy !== null}
                className={`${buttonClass} bg-main text-bg border-main`}
              >
                {busy === 'magic' ? <Spinner size={15} /> : <Mail size={15} />}
                Email me a sign-in link
              </button>
              <button
                type="button"
                onClick={handleOtp}
                disabled={!emailValid || busy !== null}
                className={`${buttonClass} bg-transparent text-main border-border hover:bg-panel-hover`}
              >
                {busy === 'otp' ? <Spinner size={15} /> : <KeyRound size={15} />}
                Send me a 6-digit code
              </button>
              <button
                type="button"
                onClick={async () => {
                  setEmail('demo@spigot.sh');
                  setBusy('demo');
                  setError(null);
                  try {
                    const result = await authApi.requestOtp('demo@spigot.sh');
                    if (result.devCode) {
                      await authApi.verifyOtp('demo@spigot.sh', result.devCode);
                      await refresh();
                      closeSignIn();
                    } else {
                      setMode('otp-code');
                    }
                  } catch (err) {
                    setError(errorMessage(err, '1-Click sign-in failed'));
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy !== null}
                className={`${buttonClass} bg-panel text-muted border-border hover:text-main text-xs mt-1`}
              >
                {busy === 'demo' ? <Spinner size={14} /> : <Zap size={14} />}
                1-Click Testnet Sign-In (Demo Account)
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
                Dev mode — sign in without the email
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
              className={`${buttonClass} bg-main text-bg border-main`}
            >
              {busy === 'verify' && <Spinner size={15} />}
              Verify and sign in
            </button>
          </>
        )}

        {notice && (
          <p className="mt-4 text-xs text-muted border border-border rounded-md px-3 py-2">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 text-xs text-error border border-error/40 bg-error/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default SignInModal;
