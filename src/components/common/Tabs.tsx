'use client';

import React, { useRef } from 'react';

export interface TabItem {
  /** Stable identifier. Reflect this in the URL so a view can be linked to. */
  value: string;
  /** One or two word destination noun. No counts: the count changes and the width moves with it. */
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** `underline` is page-level; `segmented` switches a view inside a panel. */
  variant?: 'underline' | 'segmented';
  /** Names the tablist when no visible heading does. */
  label?: string;
  className?: string;
}

/**
 * Sibling views of one subject inside one page. Moving between unrelated pages is navigation,
 * not tabs.
 *
 * Pick one variant per screen. Both forms on the same page produces two competing levels of
 * "current": the dashboard uses `underline`, anything nested in a card uses `segmented`.
 *
 * Selection is neutral throughout, never accent, so a focused tab and a selected tab stay
 * distinguishable.
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  value,
  onChange,
  variant = 'underline',
  label,
  className = '',
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Left and Right move between tabs, Home and End jump to the ends. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex(t => t.value === value);
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (i - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to].value);
    refs.current[to]?.focus();
  };

  const segmented = variant === 'segmented';

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={
        segmented
          ? `inline-flex gap-1 rounded-md border border-border bg-panel p-1 ${className}`
          : `flex gap-6 border-b border-border ${className}`
      }
    >
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            /* Roving tabindex: one stop for the whole group, arrows move within it. */
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={
              segmented
                ? `cursor-pointer rounded px-3 py-1.5 text-sm ${
                    on
                      ? 'border border-border bg-bg text-main'
                      : 'border border-transparent text-muted hover:text-main'
                  }`
                : /* -1px so the active rule sits on the container border rather than beside it */
                  `-mb-px cursor-pointer border-b px-1 py-3 text-sm ${
                    on ? 'border-main text-main' : 'border-transparent text-muted hover:text-main'
                  }`
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};
