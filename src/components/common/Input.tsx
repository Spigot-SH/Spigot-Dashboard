'use client';

import React, { InputHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';

interface BaseProps {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };

type Props = InputProps | TextareaProps;

export const Input: React.FC<Props> = props => {
  const { label, error, helperText, icon, as = 'input', className = '', ...rest } = props;

  // useId, not Math.random: the server and the client must produce the same id, or React
  // reports a hydration mismatch and the label/input pairing breaks for screen readers.
  const generatedId = useId();
  const id = props.id || props.name || generatedId;

  const baseInputClasses = `w-full bg-panel border ${error ? 'border-error/50 focus:border-error' : 'border-border focus:border-white/40'} rounded-md text-main text-sm placeholder:text-muted focus:outline-none bg-transparent`;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-muted flex items-center justify-center">{icon}</div>
        )}
        {as === 'textarea' ? (
          <textarea
            id={id}
            className={`${baseInputClasses} py-2.5 min-h-[100px] resize-y ${icon ? 'pl-9 pr-3' : 'px-3'}`}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={id}
            className={`${baseInputClasses} py-2 ${icon ? 'pl-9 pr-3' : 'px-3'}`}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>
      {(error || helperText) && (
        <span className={`text-xs ${error ? 'text-error' : 'text-muted'}`}>
          {error || helperText}
        </span>
      )}
    </div>
  );
};
