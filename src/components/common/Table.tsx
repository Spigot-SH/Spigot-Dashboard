'use client';

import React, { TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Rows of the same shape, where at least one column is worth comparing down the column.
 *
 * The wrapper is the point: a wide table scrolls inside its own box rather than pushing the
 * page sideways. One descriptive row with a control beside it is not a table.
 *
 * `<thead>`, `<tbody>` and `<tr>` need no styling, so they stay native. Only the cells are
 * wrapped, because only the cells were being copied.
 */
export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto ${className}`}>
    <table className="w-full text-left border-collapse">{children}</table>
  </div>
);

interface CellProps {
  /** Right-aligns, and on a body cell switches on tabular figures so digits line up. */
  numeric?: boolean;
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & CellProps;
type TdProps = TdHTMLAttributes<HTMLTableCellElement> & CellProps & { mono?: boolean };

export const Th: React.FC<ThProps> = ({ numeric, className = '', children, ...rest }) => (
  <th
    className={`p-4 border-b border-border text-sm font-medium text-muted ${numeric ? 'text-right' : ''} ${className}`}
    {...rest}
  >
    {children}
  </th>
);

export const Td: React.FC<TdProps> = ({ numeric, mono, className = '', children, ...rest }) => (
  <td
    className={`p-4 border-b border-border text-sm ${numeric ? 'text-right tabular-nums' : ''} ${mono ? 'font-mono' : ''} ${className}`}
    {...rest}
  >
    {children}
  </td>
);

/**
 * The "nothing here" row.
 *
 * A full page with no data at all wants an EmptyState outside the table instead. This is for
 * a table that is a real part of a populated page and simply has no rows yet.
 */
export const TdEmpty: React.FC<{ colSpan: number; children: React.ReactNode }> = ({
  colSpan,
  children,
}) => (
  <td colSpan={colSpan} className="p-4 text-center text-sm text-muted">
    {children}
  </td>
);
