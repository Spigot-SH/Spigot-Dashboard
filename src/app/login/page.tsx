import { Suspense } from 'react';
import type { Metadata } from 'next';
import Login from '../../views/Login';

export const metadata: Metadata = { title: 'Sign in' };

/** `useSearchParams` reads `?next=`, so the tree below it needs a boundary to prerender. */
export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
