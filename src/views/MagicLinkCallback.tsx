'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { Spinner } from '../components/common/Spinner';

/**
 * Where a magic-link email points instead of straight at the backend.
 *
 * The token rides in the URL fragment (`#token=...&email=...`), which the browser never sends
 * to any server, so it never lands in an edge or access log — unlike a `?token=` query string.
 * This page reads the fragment client-side and POSTs it to the backend, which is the only way
 * to consume it. `AuthContext` picks up the resulting session on the next page from
 * `?signed_in=1`, the same as it always has.
 */
export default function MagicLinkCallback() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token') || '';
    const email = params.get('email') || '';
    // Drop the fragment immediately so it doesn't sit in browser history either.
    window.history.replaceState({}, '', window.location.pathname);

    if (!token || !email) {
      router.replace('/login?auth_error=invalid_or_expired_link');
      return;
    }

    authApi
      .verifyMagicLink(email, token)
      .then(() => router.replace('/?signed_in=1'))
      .catch((err: unknown) => {
        const code = err instanceof Error && err.message ? err.message : 'invalid_or_expired_link';
        router.replace(`/login?auth_error=${encodeURIComponent(code)}`);
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={24} className="text-muted" label="Signing you in" />
    </div>
  );
}
