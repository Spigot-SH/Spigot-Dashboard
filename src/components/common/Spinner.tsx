'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  /** Match the surrounding type or icon size, not the parent container. */
  size?: number;
  className?: string;
  /**
   * Announce the wait. Omit it when the spinner sits next to copy that already names the
   * work, which is the usual case: two announcements of the same wait is worse than one.
   */
  label?: string;
}

/**
 * An indeterminate wait of roughly one to three seconds.
 *
 * Mount this when the action starts. Rendering it up front and hiding it with CSS leaves the
 * rotation running while invisible, so it appears mid-turn the moment it is shown, which reads
 * as jank.
 *
 * Do not put one inside a `Button` by hand — pass `isLoading` and let the button own it.
 */
export const Spinner: React.FC<SpinnerProps> = ({ size = 16, className = '', label }) => (
  <Loader2
    size={size}
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={`animate-spin ${className}`}
  />
);
