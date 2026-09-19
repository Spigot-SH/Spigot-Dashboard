'use client';

import React from 'react';

type Status = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'DRAFT' | 'PUBLISHED' | 'PENDING';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusStyles = (s: Status) => {
    switch (s) {
      case 'ONLINE':
      case 'PUBLISHED':
        return {
          bg: 'bg-success/10',
          text: 'text-success',
          border: 'border-success/20',
          dot: 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]',
        };
      case 'DEGRADED':
      case 'PENDING':
        return {
          bg: 'bg-warning/10',
          text: 'text-warning',
          border: 'border-warning/20',
          dot: 'bg-warning',
        };
      case 'OFFLINE':
        return {
          bg: 'bg-error/10',
          text: 'text-error',
          border: 'border-error/20',
          dot: 'bg-error',
        };
      case 'DRAFT':
      default:
        return { bg: 'bg-panel', text: 'text-muted', border: 'border-border', dot: 'bg-muted' };
    }
  };

  const styles = getStatusStyles(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
      {status}
    </span>
  );
};
