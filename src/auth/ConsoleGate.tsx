'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/common/Spinner';

/**
 * Routes that need an account, plus `/`, which is the console root rather than a page.
 *
 * `/test/<slug>` stays public — it is reached by a link to one API, has its own signed-out
 * card, and refuses the call until there is a session and credit behind it.
 */
const CONSOLE = ['/', '/dashboard', '/start', '/onboarding', '/profile', '/welcome'];

const onConsole = (pathname: string): boolean =>
  // `/` is matched exactly. Treating it as a prefix would swallow every route in the app.
  CONSOLE.some(route =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`),
  );

/**
 * Decides where a visitor belongs before the page under it renders.
 *
 * Three redirects, in order. A signed-out visitor to the console goes to `/login`, carrying
 * where they were headed. A signed-in user who has never answered the setup questions goes to
 * `/welcome`, once — skipping counts as an answer, so it does not loop. And `/` is the console
 * root: it belongs to nobody, so it hands the visitor to whichever of those two applies, or to
 * `/dashboard`.
 *
 * It holds the children back while a redirect is pending. Rendering them first is what makes a
 * signed-out visitor see a flash of an account page that is not theirs.
 */
export const ConsoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signedIn, loading } = useAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();

  const gated = onConsole(pathname);
  const needsSignIn = !loading && gated && !signedIn;
  // An older backend sends no profile at all. Do nothing then, or this would loop.
  const needsWelcome =
    !loading &&
    signedIn &&
    Boolean(user?.profile) &&
    Object.keys(user!.profile!).length === 0 &&
    pathname !== '/welcome';
  // The root has no content of its own, so a signed-in visitor who is past setup moves on.
  const needsConsole = !loading && signedIn && !needsWelcome && pathname === '/';

  useEffect(() => {
    if (needsSignIn) {
      // `/` carries no `next`: it is where the visitor lands by default, not somewhere they
      // asked to be, and `?next=%2F` would bounce them straight back here after signing in.
      router.replace(pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (needsWelcome) {
      router.replace('/welcome');
      return;
    }
    if (needsConsole) router.replace('/dashboard');
  }, [needsSignIn, needsWelcome, needsConsole, pathname, router]);

  if (needsSignIn || needsWelcome || needsConsole || (gated && loading)) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size={24} className="text-muted" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ConsoleGate;
