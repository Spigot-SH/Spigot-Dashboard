'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import SignInPanel from '../auth/SignInPanel';
import { Spinner } from '../components/common/Spinner';
import { Logo } from '../components/common/Logo';
import LoginArtwork from '../auth/LoginArtwork';

/** Only same-origin paths. A full URL in `?next=` would be an open redirect. */
const safeNext = (value: string | null): string =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

/** Terms and Privacy live on the marketing site, which is a different repo and origin. */
const SITE = 'https://spigot.sh';

export default function Login() {
  const { signedIn, loading } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));

  // Already signed in: this page has nothing to offer. Same for the moment sign-in succeeds.
  useEffect(() => {
    if (!loading && signedIn) router.replace(next);
  }, [loading, signedIn, next, router]);

  const onSignedIn = useCallback(() => router.replace(next), [router, next]);

  return (
    <div className="flex min-h-screen w-full">
      {/* Form column. The only column until there is room for the panel beside it.
          `py-10` plus `min-h-screen` means a short viewport scrolls rather than clipping. */}
      <div className="flex w-full items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex justify-center">
            <Logo
              // Sized in `vw` up to a cap so the mark never crowds a narrow screen.
              size={72}
              title="Spigot"
              className="h-[clamp(52px,14vw,72px)] w-[clamp(52px,14vw,72px)] text-main"
            />
          </div>

          <h1 className="mb-7 text-center text-[clamp(1.75rem,7vw,2.25rem)] font-semibold leading-tight tracking-tight text-main">
            Welcome to Spigot
          </h1>

          {loading || signedIn ? (
            <div className="flex justify-center py-10">
              <Spinner size={24} className="text-muted" />
            </div>
          ) : (
            <SignInPanel onSignedIn={onSignedIn} />
          )}

          <p className="mt-7 text-center text-xs leading-relaxed text-muted">
            By continuing, you agree to our{' '}
            <a href={`${SITE}/terms`} className="text-main underline">
              Terms
            </a>{' '}
            and{' '}
            <a href={`${SITE}/privacy`} className="text-main underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* Hidden below `lg`, so the artwork never costs a phone the download. */}
      <aside className="hidden p-3 lg:block lg:w-1/2">
        <LoginArtwork />
      </aside>
    </div>
  );
}
