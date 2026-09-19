'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { hashString } from '../../lib/hash';

/**
 * Five categorical hues across nineteen skills cannot identify anything, so hue is not the
 * identifier here: the name is. The dot carries the hue only so a row of tags has texture.
 * The label stays neutral.
 *
 * Assigned by hash of the name, never by array index, so reordering the list does not
 * silently recolour every tag.
 */
const CAT_DOT = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5'] as const;

function dotFor(name: string): string {
  return CAT_DOT[hashString(name) % CAT_DOT.length];
}

/** Display only. A tag is never clickable; if the user can act on it, it is a `SkillOption`. */
export const SkillTag: React.FC<{ name: string; className?: string }> = ({
  name,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-2 rounded-md border border-border bg-panel px-2.5 py-1 text-xs text-main ${className}`}
  >
    <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotFor(name)}`} aria-hidden="true" />
    {name}
  </span>
);

interface SkillOptionProps {
  name: string;
  selected?: boolean;
  onToggle?: (name: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The control form. Keeps a real hit target and real button semantics.
 *
 * Selected is neutral, never accent: accent is reserved for focus, so a selected option that
 * also has focus has to show both at once. Selection is border plus fill plus a check, so it
 * survives with colour switched off.
 */
export const SkillOption: React.FC<SkillOptionProps> = ({
  name,
  selected = false,
  onToggle,
  disabled = false,
  className = '',
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={selected}
    disabled={disabled}
    onClick={() => onToggle?.(name)}
    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
      selected
        ? 'border-main bg-panel-hover text-main'
        : 'border-border bg-panel text-muted hover:text-main'
    } ${className}`}
  >
    <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotFor(name)}`} aria-hidden="true" />
    {name}
    {selected && <Check size={14} aria-hidden="true" />}
  </button>
);
