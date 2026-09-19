'use client';

import React from 'react';

interface EmptyStateProps {
  /** Title Case, and specific. "No data" is not an empty state. */
  title: string;
  /** Adds something the title did not, rather than restating it. */
  description?: string;
  icon?: React.ReactNode;
  /** Exactly one action, and a real button or link so it joins the tab order. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Artwork, heading, one line of explanation, exactly one action.
 *
 * Which wording to use depends on *why* the surface is empty: nothing created yet, a filter
 * that matched nothing, or a load that failed. Those are three different messages, and a
 * single generic one covers none of them.
 *
 * Never the home for a warning that must persist. An empty state disappears the moment the
 * list fills, taking the warning with it.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className}`}
  >
    {icon && (
      <span className="text-muted" aria-hidden="true">
        {icon}
      </span>
    )}
    <h3 className="text-base font-medium text-main">{title}</h3>
    {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
