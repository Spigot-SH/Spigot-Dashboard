'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Dark or light, as one answer two components can read.
 *
 * This is the same shape as `consoleView.ts` and exists for the same reason: the header's
 * toggle and the settings page both set it, and `localStorage` alone will not keep them in
 * step, because writing it raises no event in the tab that wrote it. `useSyncExternalStore`
 * is the API for a value that lives outside React and is absent on the server.
 *
 * It used to live in `Header.tsx` as component state. That was correct while the header was
 * the only place you could change it, and wrong the moment settings grew an appearance row.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'x402_theme';
const CHANGED = 'x402:theme';
const DEFAULT: Theme = 'dark';

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  // Another tab changing it arrives as `storage`, which only fires in the other tabs.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
};

const read = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT;
  } catch {
    // Private mode, blocked site data. A preference is not worth a crash.
    return DEFAULT;
  }
};

/**
 * Paint the choice onto the document.
 *
 * Kept out of the hook so that whoever reads the theme does not also have to own applying it.
 * `data-theme` is what `src/styles/index.css` keys the light palette off.
 */
const apply = (theme: Theme) => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const useTheme = () => {
  const theme = useSyncExternalStore(
    subscribe,
    read,
    // The server has no localStorage, so it renders the default and the client corrects it.
    () => DEFAULT,
  );

  const choose = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is no reason to refuse making it.
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { theme, choose };
};

/**
 * Put the stored theme on the document once, on load.
 *
 * Separate from `useTheme` because every consumer of the hook would otherwise race to write
 * the same attribute, and because the attribute has to be set even on a page that only reads
 * the theme rather than offering to change it.
 */
export const applyStoredTheme = () => {
  apply(read());
};
