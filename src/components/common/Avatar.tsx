'use client';

import React, { useState } from 'react';
import { hashString } from '../../lib/hash';

interface AvatarProps {
  /** The entity's full name. Also the accessible name. */
  name: string;
  /**
   * An uploaded image. When present it wins; the dot grid is the fallback, not the default.
   *
   * A broken or slow URL falls back to the grid rather than to a broken-image glyph, so a
   * dead link degrades to something deliberate instead of something that looks like a bug.
   */
  src?: string | null;
  /**
   * The moment this entity was created, as an ISO string or epoch millis.
   *
   * Stored once and passed in, never read from the clock at render time. Two publishers called
   * "Acme" then get different avatars, while each one keeps the same avatar forever.
   *
   * Reading the current time here instead would generate a different pattern on the server than
   * in the browser, which React reports as a hydration mismatch and the user sees as a flicker.
   */
  seed?: string | number;
  size?: 'md' | 'lg';
  className?: string;
}

const SIZE = { md: 28, lg: 40 } as const;

/**
 * One hue per avatar, from the categorical ramp.
 *
 * Categorical and not semantic on purpose: an identity is a category, never a health state.
 * Using `success` or `error` here would make a person look like a status.
 */
const HUES = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5'] as const;

/**
 * A 5×5 dot grid, mirrored down the centre, derived from a hash of the name and the creation
 * timestamp. The same entity always renders the same avatar, on every device and on the server.
 *
 * The pattern carries the identity and the hue carries variety, in that order. Read the hue
 * alone and two different people can look alike; read the pattern and they never do. That
 * ordering matters at 28px, where the grid is legible but the tint is barely a suggestion.
 *
 * One of only two places `rounded-full` is permitted.
 */
export const Avatar: React.FC<AvatarProps> = ({ name, src, seed, size = 'md', className = '' }) => {
  const px = SIZE[size];
  const [imageFailed, setImageFailed] = useState(false);

  if (src && !imageFailed) {
    return (
      // Plain <img>, not next/image: an avatar URL is user-supplied and arbitrary, and
      // next/image refuses any host not in the `images.remotePatterns` allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        title={name}
        width={px}
        height={px}
        style={{ width: px, height: px }}
        onError={() => setImageFailed(true)}
        className={`inline-block shrink-0 rounded-full border border-border object-cover ${className}`}
      />
    );
  }

  const h = hashString(`${name}|${seed ?? ''}`);
  const hue = HUES[h % HUES.length];

  const cells = Array.from({ length: 25 }, (_, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    // Columns 4 and 5 mirror 2 and 1, so only the left three are drawn from the hash.
    const src = col < 3 ? col : 4 - col;
    const bit = row * 3 + src;
    return {
      on: ((h >>> bit) & 1) === 1,
      // A second slice of the same hash varies the weight, so a filled grid still has texture.
      strong: ((h >>> (bit + 15)) & 1) === 1,
    };
  });

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{ width: px, height: px, padding: Math.round(px * 0.18) }}
      className={`inline-grid shrink-0 grid-cols-5 grid-rows-5 gap-px rounded-full border border-border bg-panel ${className}`}
    >
      {cells.map((c, i) => (
        <i
          key={i}
          className={
            c.on ? `rounded-[1px] ${hue} ${c.strong ? 'opacity-100' : 'opacity-55'}` : undefined
          }
        />
      ))}
    </span>
  );
};
