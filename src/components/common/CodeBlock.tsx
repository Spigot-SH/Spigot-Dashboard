'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  /** Shown in the header. `json`, `bash`, `http`. */
  language?: string;
  /** A shell prompt is drawn by the block and is never part of what gets copied. */
  prompt?: boolean;
  className?: string;
}

/**
 * The most load-bearing component in an API product: request and response bodies, curl
 * snippets and the x402 payment header all render here.
 *
 * Mono throughout, horizontal scroll, never wrapped. A wrapped JSON body is unreadable, and a
 * wrapped hash cannot be compared against another one.
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  prompt = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear on unmount, or the callback fires against a component that is gone.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(() => {
    // The prompt is chrome, so it is never in the clipboard payload.
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-panel ${className}`}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          {language ?? 'code'}
        </span>
        {/*
          The glyph changes shape as well as colour, so the confirmation still reads with hue
          removed. It reverts after 1.5s: long enough to notice, short enough that the control
          is ready again before the user is.
        */}
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-xs text-muted hover:bg-panel-hover hover:text-main"
        >
          {copied ? (
            <Check size={12} className="text-success" aria-hidden="true" />
          ) : (
            <Copy size={12} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* `overflow-x-auto` on the container and `whitespace-pre` on the code: scroll, never wrap. */}
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre text-main">
        {prompt ? (
          <>
            <span className="select-none text-muted">$ </span>
            {code}
          </>
        ) : (
          code
        )}
      </pre>
    </div>
  );
};
