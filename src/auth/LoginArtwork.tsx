'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * The files in `public/login-screen`. Adding a sixth needs nothing but a line here.
 *
 * WebP, not PNG. These are paintings, and PNG is lossless, so the five of them weighed 11.2 MB
 * in the repo where WebP at quality 82 holds the same picture in 646 KB. `next/image` would
 * have re-encoded them for the browser either way; the saving here is the checkout, the build
 * and every clone.
 */
const IMAGES = [1, 2, 3, 4, 5].map(n => `/login-screen/image${n}.webp`);

/**
 * The artwork beside the sign-in form. One picture, chosen at random per visit.
 *
 * It replaced a hold-then-shuffle cycle that did not look good in practice, and this is the
 * better shape for three reasons beyond taste. It is not a loop, so it does not break the rule
 * in `src/styles/index.css:68` that the skeleton is the only sanctioned one. It downloads one
 * image instead of five, which matters when each is around 2.3 MB. And there is no motion to
 * turn off, so nothing here fights `prefers-reduced-motion`.
 *
 * The choice is made in an effect, never during render: `Math.random()` on the server and
 * again on the client would disagree and React would warn about the mismatch.
 */
export const LoginArtwork: React.FC = () => {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * IMAGES.length));
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-panel">
      {index !== null && (
        <Image
          src={IMAGES[index]}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 0px"
          // A one-shot fade, so the picture arrives rather than snapping in against the panel.
          className="animate-[fade-in_400ms_cubic-bezier(0.16,1,0.3,1)_both] object-cover"
        />
      )}
    </div>
  );
};

export default LoginArtwork;
