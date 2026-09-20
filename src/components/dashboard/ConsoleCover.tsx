'use client';

import React from 'react';
import Image from 'next/image';

/**
 * The two cover paintings in `public/dashboard`, named for the console each one heads.
 *
 * `useapicover` goes above the caller console and `myapicover` above the publisher one, which
 * is the same pairing the header pills use: "Use APIs" and "My APIs".
 */
export const CONSOLE_COVERS = {
  caller: '/dashboard/useapicover.webp',
  provider: '/dashboard/myapicover.webp',
} as const;

interface Props {
  src: string;
  title: string;
  subtitle: string;
  /** Sits at the right end of the banner, on the scrim. */
  action?: React.ReactNode;
}

/**
 * The heading of a console overview, set on its cover painting.
 *
 * Both files are 1672x941, a 1.777 ratio. The banner is wider than that, so `object-cover`
 * crops vertically: the visible band is `1.777 / bannerRatio` of the image's height, and
 * `object-position` decides where that band sits.
 *
 * The numbers here are the whole reason the mark is not cut in half. A 4.7:1 banner showed 38%
 * of the image, and the mark is taller than that in both paintings, so its points were sliced
 * off top and bottom. At 3:1 the band is 59%, and pinning the position to 12% puts that band
 * over image rows 4.9% to 64.1%, which contains the mark with clear space around it in both
 * files. Checked by cropping exactly those rows out of both PNGs and looking at them. If the
 * banner is made shorter again, the mark starts losing its points; that is the constraint.
 *
 * The scrim is `black`, not a semantic token, and deliberately so. Every other colour in this
 * repo resolves through a token because it has to follow the light and dark palettes, but this
 * one sits between a painting and the text on top of it. The painting does not change with the
 * theme, so neither should the thing making its text legible. It is also held to the lower
 * third rather than washed across the whole banner, because the point of the banner is the
 * picture.
 */
export const ConsoleCover: React.FC<Props> = ({ src, title, subtitle, action }) => (
  <section className="relative mb-8 overflow-hidden rounded-xl border border-border">
    <div className="relative aspect-[16/11] w-full sm:aspect-[2/1] lg:aspect-[3/1]">
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1024px) 1100px, 100vw"
        className="object-cover object-[center_12%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 via-30% to-transparent"
      />
    </div>

    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6">
      <div className="min-w-0">
        {/* White, not `text-main`: the text sits on the scrim in both themes, never on the page. */}
        <h1 className="m-0 text-3xl text-white drop-shadow">{title}</h1>
        <p className="m-0 mt-1 max-w-xl whitespace-normal text-sm text-white/80">{subtitle}</p>
      </div>
      {action}
    </div>
  </section>
);

export default ConsoleCover;
