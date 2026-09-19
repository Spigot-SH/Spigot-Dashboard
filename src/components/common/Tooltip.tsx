'use client';

import React, { useId } from 'react';

interface TooltipProps {
  /** One sentence or fragment, sentence case. No full stop on a fragment. */
  text: string;
  children: React.ReactNode;
  /** Flip below when there is no room above. */
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Short clarification on hover or keyboard focus.
 *
 * Never the only place information lives. A tooltip does not exist on touch and is invisible
 * to anyone scanning the page, so if a value cannot be understood without it, the tooltip is
 * the wrong component: use helper text under the field, or a `SpecRow`.
 *
 * Explains why something exists or why it is unavailable. Not a repeat of a visible label.
 *
 * Never put an action inside one, and never render one inside a container with
 * `overflow: hidden` — it will be clipped, and the clipping is invisible until someone hovers.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  text,
  children,
  side = 'top',
  className = '',
}) => {
  const id = useId();

  return (
    <span className={`group relative inline-flex ${className}`}>
      {/*
        `focus-within` would be wrong here: clicking the trigger focuses it, which leaves the
        tooltip stuck open after the pointer has moved away. `focus-visible` opens it for
        keyboard focus only, which is what it is for.
      */}
      <span aria-describedby={id} className="peer inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-dropdown w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-main opacity-0 shadow-lg transition-opacity delay-150 duration-150 group-hover:opacity-100 peer-has-[:focus-visible]:opacity-100 ${
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        {text}
      </span>
    </span>
  );
};
