'use client';

import React from 'react';

interface SkeletonProps {
  /** Any CSS width. Match the real content so nothing shifts when data arrives. */
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * A loading placeholder shaped like the thing that is coming.
 *
 * Every view in this app fetches on mount, so this is not optional: a blank panel and a
 * centred spinner both throw away the layout the user is about to read. A skeleton of the
 * wrong shape is worse than none, because the layout jumps the moment data lands.
 *
 * Never permanent decoration, and never a stand-in for an empty state. A list that is empty
 * is empty, not loading.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height = '1em', className = '' }) => (
  <span
    aria-hidden="true"
    style={{ width, height }}
    className={`block rounded-sm bg-panel-hover animate-skeleton ${className}`}
  />
);

/**
 * Wrap the region that is loading. Announces the wait once, rather than once per placeholder,
 * and keeps the placeholders themselves out of the accessibility tree.
 */
export const SkeletonRegion: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ loading, children, className = '' }) => (
  <div aria-busy={loading || undefined} aria-live="polite" className={className}>
    {children}
  </div>
);

/**
 * Placeholder rows for a `Table`.
 *
 * The header is not included: column names are known before the request resolves, so they
 * render immediately and only the body waits.
 */
export const SkeletonRows: React.FC<{ rows?: number; cols: number }> = ({ rows = 5, cols }) => (
  <>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }, (_, c) => (
          <td key={c} className="border-b border-border p-4">
            {/* Varying the width stops the block reading as a solid rectangle. */}
            <Skeleton width={c === 0 ? '60%' : '40%'} />
          </td>
        ))}
      </tr>
    ))}
  </>
);
