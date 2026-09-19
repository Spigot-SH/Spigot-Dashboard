'use client';

import React, { SelectHTMLAttributes, useId } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * A native `<select>` with the platform chevron suppressed and ours drawn in.
 *
 * Native is deliberate: keyboard behaviour, screen-reader semantics and the mobile picker
 * all come for free. A custom listbox would need roving tabindex, type-ahead and ARIA
 * wiring, none of which is visible in a screenshot.
 *
 * Structure mirrors `Input` so a form built from both lines up: same label role, same error
 * placement, same gap.
 */
export const Select: React.FC<SelectProps> = props => {
  const { label, error, helperText, className = '', children, ...rest } = props;

  // useId, not Math.random: the server and the client must produce the same id, or React
  // reports a hydration mismatch and the label/select pairing breaks for screen readers.
  const generatedId = useId();
  const id = props.id || props.name || generatedId;
  const describedBy = error || helperText ? `${id}-msg` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none bg-panel border rounded-md text-main text-sm py-2 pl-3 pr-9 focus:outline-none ${
            error ? 'border-error focus:border-error' : 'border-border focus:border-accent'
          }`}
          {...rest}
        >
          {children}
        </select>
        {/* pointer-events-none so the click still reaches the select underneath */}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="absolute right-3 text-muted pointer-events-none"
        />
      </div>
      {(error || helperText) && (
        <span id={describedBy} className={`text-xs ${error ? 'text-error' : 'text-muted'}`}>
          {error || helperText}
        </span>
      )}
    </div>
  );
};
