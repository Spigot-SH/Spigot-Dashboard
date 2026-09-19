'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';

interface FileUploadProps {
  /** Mirrors the `accept` attribute: `image/*`, `.json,.yaml`. */
  accept?: string;
  /** Rejected above this, before anything is read or sent. */
  maxBytes?: number;
  onFile: (file: File) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Drag, drop or browse for a single file.
 *
 * This hands the `File` to `onFile` and stops there: it does not upload. The caller decides
 * where the bytes go, because the two surfaces that need this send them to different places.
 *
 * A drop zone that looks interactive and does nothing is worse than no drop zone, so the whole
 * area is a real target and the hidden input keeps click, keyboard and the native file picker
 * working for free.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxBytes,
  onFile,
  label,
  hint,
  disabled = false,
  className = '',
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs leak until revoked, so the previous one goes whenever it is replaced.
  useEffect(() => {
    if (!chosen || !chosen.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(chosen);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [chosen]);

  const accepts = useCallback(
    (file: File) => {
      if (!accept) return true;
      // `image/*` style wildcards and bare extensions both have to work.
      return accept.split(',').some(rule => {
        const r = rule.trim().toLowerCase();
        if (r.endsWith('/*')) return file.type.toLowerCase().startsWith(r.slice(0, -1));
        if (r.startsWith('.')) return file.name.toLowerCase().endsWith(r);
        return file.type.toLowerCase() === r;
      });
    },
    [accept],
  );

  const take = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!accepts(file)) {
        setError(`That file type is not accepted. Expected ${accept}.`);
        return;
      }
      if (maxBytes && file.size > maxBytes) {
        setError(
          `That file is ${readableSize(file.size)}. The limit is ${readableSize(maxBytes)}.`,
        );
        return;
      }
      setError(null);
      setChosen(file);
      onFile(file);
    },
    [accept, accepts, maxBytes, onFile],
  );

  const clear = () => {
    setChosen(null);
    setError(null);
    // Without this the same file cannot be re-picked: the input still holds the old value.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium uppercase tracking-wider text-muted"
        >
          {label}
        </label>
      )}

      <div
        onDragOver={e => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) take(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center ${
          disabled
            ? 'border-border opacity-50'
            : dragging
              ? 'border-accent bg-accent/5'
              : error
                ? 'border-error'
                : 'border-border hover:border-accent'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-16 w-16 rounded-md object-cover" />
        ) : (
          <UploadCloud size={28} className="text-muted" aria-hidden="true" />
        )}

        {chosen ? (
          <p className="flex items-center gap-2 text-sm text-main">
            <span className="font-mono">{chosen.name}</span>
            <span className="text-muted tabular-nums">{readableSize(chosen.size)}</span>
            <button
              type="button"
              onClick={clear}
              aria-label={`Remove ${chosen.name}`}
              className="cursor-pointer text-muted hover:text-main"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Drag a file here, or{' '}
            <label
              htmlFor={inputId}
              className="cursor-pointer text-accent underline underline-offset-2"
            >
              browse
            </label>
          </p>
        )}

        {hint && !chosen && <p className="text-xs text-muted">{hint}</p>}

        {/* The real control. Visually hidden rather than `display:none`, so it stays focusable. */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={e => take(e.target.files?.[0])}
          className="sr-only"
        />
      </div>

      {error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
};
