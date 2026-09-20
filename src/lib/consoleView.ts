'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Which console is showing. A person can be both, so this is a view, not a role.
 *
 * It lives here rather than in `Dashboard.tsx` because the switch is in the header and the
 * thing it switches is the page: two components, one answer.
 *
 * `useSyncExternalStore` is the API for exactly this shape — a value that lives outside React,
 * read on the client and not available on the server. Reading it into state inside an effect
 * instead is what the lint rule about cascading renders is pointing at, and it also paints the
 * wrong console for a frame before correcting itself.
 *
 * A per-browser preference like the theme. It changes nothing on the account, so it does not
 * belong on it.
 */
export type ConsoleView = 'provider' | 'caller';

const STORAGE_KEY = 'x402_console_view';
const CHANGED = 'x402:console-view';

/** Writing `localStorage` fires no event in the tab that wrote it, so the setter raises one. */
const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  // Another tab changing it arrives as `storage`, which only fires in the other tabs.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
};

const read = (): ConsoleView | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'provider' || stored === 'caller' ? stored : null;
  } catch {
    // Private mode, blocked site data. The default is fine; a preference is not worth a crash.
    return null;
  }
};

/**
 * Where someone lands before they have chosen, derived in one place so the header and the page
 * cannot disagree on the first paint.
 *
 * Calling is the default: it needs no publisher account, so it has something to show everyone.
 * `sell` is the one answer that overrides it, because step 1 of the setup says in as many
 * words that it chooses your console, and a question that changes nothing would be a lie.
 */
export const consoleFallback = (intent: string | undefined): ConsoleView =>
  intent === 'sell' ? 'provider' : 'caller';

export const useConsoleView = (fallback: ConsoleView = 'caller') => {
  const view = useSyncExternalStore(
    subscribe,
    () => read() ?? fallback,
    // The server has no localStorage, so it renders the fallback and the client corrects it.
    () => fallback,
  );

  const choose = useCallback((next: ConsoleView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is no reason to refuse making it.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { view, choose };
};
