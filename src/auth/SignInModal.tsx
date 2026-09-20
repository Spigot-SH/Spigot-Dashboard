'use client';

import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import SignInPanel from './SignInPanel';

/**
 * The sign-in form as an overlay, for the public pages.
 *
 * The console redirects to `/login` instead — see `ConsoleGate` in `app/providers.tsx`. Both
 * render the same `SignInPanel`. The panel is mounted only while the modal is open, so closing
 * it discards the half-typed email and any error by unmounting.
 */
const SignInModal: React.FC = () => {
  const { signInOpen, closeSignIn } = useAuth();

  // Escape closes, matching every other dismissable surface.
  useEffect(() => {
    if (!signInOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSignIn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signInOpen, closeSignIn]);

  if (!signInOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={closeSignIn}
    >
      <div
        className="w-full max-w-[400px] rounded-xl border border-border bg-panel p-6"
        onClick={e => e.stopPropagation()}
      >
        <SignInPanel onSignedIn={closeSignIn} />
      </div>
    </div>
  );
};

export default SignInModal;
