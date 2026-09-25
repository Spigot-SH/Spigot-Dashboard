'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, SessionState, AuthUser, PublisherInfo, WalletInfo, Balances } from '../api/auth';
import { clearAuth, clearLegacyApiKey } from '../api/client';
import { SIGNED_OUT_STATE, parseSessionState } from './sessionState';

interface AuthContextValue {
  user: AuthUser | null;
  publisher: PublisherInfo | null;
  credits: number;
  wallet: WalletInfo | null;
  evmWallet: WalletInfo | null;
  balances: Balances | null;
  /** Server-computed from the credit ledger; the dashboard must not decide this itself. */
  tutorialUnlocked: boolean;
  loading: boolean;
  signedIn: boolean;
  /**
   * Returns the freshly fetched session, not just the applied state — a caller that must act
   * on the result right after calling this (e.g. "only open the tutorial once the ledger
   * confirms the unlock") cannot read `tutorialUnlocked` from this context afterward and trust
   * it: `setState` above has not necessarily re-rendered yet, so that value can still be the
   * one from before the call.
   */
  refresh: () => Promise<SessionState>;
  signOut: () => Promise<void>;
  openSignIn: () => void;
  closeSignIn: () => void;
  signInOpen: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>({
    user: null,
    publisher: null,
    credits: 0,
    wallet: null,
    evmWallet: null,
    balances: null,
  });
  const [loading, setLoading] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);

  const refresh = useCallback(async (): Promise<SessionState> => {
    let next: SessionState;
    try {
      next = parseSessionState(await authApi.me());
    } catch {
      next = SIGNED_OUT_STATE;
    }
    setState(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    // Runs on every app load, not only at sign-out: a browser that is already signed in when
    // it upgrades to this build would otherwise keep a legacy key in storage indefinitely,
    // since sign-out is exactly the event such a session never fires.
    clearLegacyApiKey();
    void refresh();
  }, [refresh]);

  // The magic-link callback lands back here with ?signed_in=1 after setting the cookie.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_in') === '1') {
      params.delete('signed_in');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${params.toString() ? `?${params}` : ''}`,
      );
      void refresh();
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    // The publisher API key outlives the session in localStorage, and it authenticates as the
    // publisher on its own. Leaving it behind hands the next person on this browser a working
    // credential, so it goes even if the logout request failed.
    clearAuth();
    setState(SIGNED_OUT_STATE);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      publisher: state.publisher || null,
      credits: state.credits ?? 0,
      wallet: state.wallet,
      evmWallet: state.evmWallet,
      balances: state.balances,
      // `state` already went through `parseSessionState`, which only ever sets this from a
      // strict `=== true` check — re-asserted here, not with `Boolean(...)`, so a future
      // caller of `setState` elsewhere in this provider cannot quietly reopen the "any
      // truthy value unlocks" bug.
      tutorialUnlocked: state.tutorialUnlocked === true,
      loading,
      signedIn: Boolean(state.user),
      refresh,
      signOut,
      signInOpen,
      openSignIn: () => setSignInOpen(true),
      closeSignIn: () => setSignInOpen(false),
    }),
    [state, loading, signInOpen, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
};
