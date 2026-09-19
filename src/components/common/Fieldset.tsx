'use client';

import React, { useId } from 'react';

interface FieldsetProps {
  /** Title Case noun naming the group. No trailing colon. */
  legend: string;
  hint?: string;
  /** An error about the group as a whole. A single field's error belongs on that field. */
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Related form controls under one label.
 *
 * A real `<fieldset>` and `<legend>`, so a screen reader announces the group before each field
 * inside it. A styled `<div>` with a heading looks identical and announces nothing, which is
 * why the onboarding steps that hand-roll this pattern read as a flat run of inputs.
 */
export const Fieldset: React.FC<FieldsetProps> = ({
  legend,
  hint,
  error,
  children,
  className = '',
}) => {
  const id = useId();

  return (
    <fieldset
      aria-describedby={error || hint ? id : undefined}
      className={`flex flex-col gap-4 rounded-lg border p-5 ${error ? 'border-error' : 'border-border'} ${className}`}
    >
      <legend className="px-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {legend}
      </legend>
      {hint && !error && (
        <p id={id} className="-mt-2 text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={id} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
};
