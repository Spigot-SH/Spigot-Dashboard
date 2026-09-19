'use client';

import React, { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed';

  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantMap = {
    primary: 'bg-accent text-on-accent hover:bg-accent-dim border border-transparent',
    secondary: 'bg-transparent text-main border border-border hover:bg-panel-hover',
    danger:
      'bg-transparent text-muted border border-white/15 hover:text-error hover:border-error/50',
    ghost:
      'bg-transparent text-muted hover:text-main hover:bg-panel-hover border border-transparent',
  };

  /**
   * Loading is not the same state as disabled.
   *
   * `disabled` means the action is impossible, so the native attribute is right and removing
   * the control from the tab order is correct. Loading means the action is under way: the
   * button must stay focusable so a keyboard user does not lose their place mid-request, and
   * `aria-busy` is what announces the wait. A native `disabled` would do neither.
   *
   * Because it stays enabled, the click has to be swallowed here — including on a submit
   * button, which would otherwise post the form again.
   */
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      className={`${baseClasses} ${sizeMap[size]} ${variantMap[variant]} ${className}`}
      disabled={disabled}
      aria-busy={isLoading || undefined}
      aria-disabled={isLoading || undefined}
      onClick={handleClick}
      {...props}
    >
      {isLoading && <Spinner size={16} />}
      <span>{children}</span>
    </button>
  );
};
