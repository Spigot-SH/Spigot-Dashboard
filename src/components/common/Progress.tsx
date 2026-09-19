'use client';

import React from 'react';

interface ProgressProps {
  value: number;
  /** The real ceiling. Never hardcode 100 when the actual total is known. */
  max?: number;
  /** Names the work. A bar with no label says something is happening, not what. */
  label?: string;
  tone?: 'accent' | 'success' | 'warning' | 'error';
  className?: string;
}

const FILL = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
} as const;

/**
 * Determinate work whose total is knowable: an upload, a multi-step import, a batch publish.
 *
 * For a wait with no known total this is the wrong component. Use `Spinner` for a short single
 * action, or `Skeleton` where the shape of the result is already known.
 */
export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  label,
  tone = 'accent',
  className = '',
}) => {
  // Guard the arithmetic rather than the caller: a NaN width silently renders nothing.
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">{label}</span>
          <span className="font-mono text-xs text-muted tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-panel-hover"
      >
        <div
          style={{ width: `${pct}%` }}
          className={`h-full rounded-full transition-[width] duration-300 ${FILL[tone]}`}
        />
      </div>
    </div>
  );
};
