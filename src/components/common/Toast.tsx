'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  /** One sentence, sentence case, no trailing full stop. */
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_MS = 4500;

const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  error: 'bg-error',
  info: 'bg-info',
};

/**
 * Transient confirmation of something that just happened.
 *
 * If the user can do nothing about it and it is already over, this is the right component. If
 * it describes a state they must resolve — low balance, unverified domain, failed
 * provisioning — use `Banner` instead: a toast for a persistent condition disappears before it
 * can be acted on.
 *
 * One toast per flow, reporting the terminal step. A publish that emits four toasts has told
 * the user nothing four times.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Not Math.random or Date.now: both differ between the server pass and the client pass.
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, text: string) => {
      const id = ++nextId.current;
      setToasts(list => [...list, { id, tone, text }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: text => push('success', text),
      error: text => push('error', text),
      info: text => push('info', text),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        `polite`, not `assertive`: a toast reports on an action the user just took, so it does
        not need to interrupt whatever is being read. The region exists even when empty, or a
        screen reader has nothing to watch when the first toast arrives.

        Above everything at `z-toast`, because it reports on the thing you just did.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-panel p-3 shadow-lg animate-toast-in"
          >
            <i
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[t.tone]}`}
              aria-hidden="true"
            />
            <p className="flex-1 text-sm text-main">{t.text}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="cursor-pointer text-muted hover:text-main"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>');
  return ctx;
}

interface BannerProps {
  tone?: Tone | 'warning';
  children: React.ReactNode;
  className?: string;
}

const BANNER_FILL: Record<Tone | 'warning', string> = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
};

/**
 * A condition that is still true, sitting inline above the content it concerns.
 *
 * Solid fill in the state colour with the text in `bg`, so it inverts with the theme rather
 * than needing a second set of values. One of only two places `rounded-full` is used.
 */
export const Banner: React.FC<BannerProps> = ({ tone = 'info', children, className = '' }) => (
  <div
    className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm text-bg ${BANNER_FILL[tone]} ${className}`}
  >
    <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-bg" aria-hidden="true" />
    {children}
  </div>
);
