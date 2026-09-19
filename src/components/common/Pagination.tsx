'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Total row count, so the component can render "Showing 1–10 of 87". */
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

/**
 * Which page numbers to show, with a truncating middle.
 *
 * Always first and last, always the current page and its neighbours, and an ellipsis wherever
 * a gap was cut. Returning a fixed-length window instead would make the control's width jump
 * as the user pages through it.
 */
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const out: (number | 'gap')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);

  if (from > 2) out.push('gap');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pageCount - 1) out.push('gap');

  out.push(pageCount);
  return out;
}

/**
 * Numbered pages, always paired with a count.
 *
 * "Page 3" means nothing without knowing there are nine. The count is the information; the
 * numbers are only the control.
 *
 * For revealing more of one list, this is the wrong component: that is a show-more.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize = 10,
  className = '',
}) => {
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = totalItems ? Math.min(page * pageSize, totalItems) : page * pageSize;

  const step = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm';
  const idle = 'border-transparent text-muted hover:text-main hover:bg-panel-hover cursor-pointer';

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-4 ${className}`}
    >
      {totalItems !== undefined && (
        <p className="text-sm text-muted tabular-nums">
          Showing {first}–{last} of {totalItems}
        </p>
      )}

      <div className="flex items-center gap-1">
        {/*
          At either end the control is genuinely disabled, not merely styled to look it, so it
          leaves the tab order rather than sitting there as a dead stop.
        */}
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={`${step} ${idle} disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent`}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={`${step} tabular-nums ${
                p === page ? 'border-border bg-panel text-main' : idle
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={`${step} ${idle} disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent`}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
