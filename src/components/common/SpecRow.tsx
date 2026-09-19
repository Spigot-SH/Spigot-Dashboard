'use client';

import React from 'react';
import { UNKNOWN } from '../../lib/format';

interface SpecRowProps {
  label: string;
  /** Omit or pass null for an unknown value; it renders as `—`, never as a blank cell. */
  value?: React.ReactNode;
  className?: string;
}

/**
 * Label left in mono caps muted, value right in mono tabular.
 *
 * The default way to present label/value data in this app: reach for it before a card. A row
 * that needs a control on the right is a `Table` row, not a spec row.
 */
export const SpecRow: React.FC<SpecRowProps> = ({ label, value, className = '' }) => (
  <div
    className={`flex flex-col gap-1 border-b border-border py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 ${className}`}
  >
    <dt className="text-xs font-medium uppercase tracking-wider text-muted">{label}</dt>
    {/*
      No truncation. A shortened hash cannot be compared against another one, which is the
      only reason it is on screen. Long values wrap instead, and below `sm` the value drops
      under the label rather than wrapping mid-number.
    */}
    <dd className="font-mono text-sm tabular-nums text-main sm:text-right">
      {value === undefined || value === null || value === '' ? UNKNOWN : value}
    </dd>
  </div>
);

/**
 * The list wrapper. Renders a real `<dl>` so a screen reader announces each pair as a pair
 * rather than as a run of unrelated text.
 */
export const SpecList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <dl className={`flex flex-col ${className}`}>{children}</dl>;
