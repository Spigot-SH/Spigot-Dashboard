'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, SessionState, AuthUser, PublisherInfo, WalletInfo, Balances } from '../api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  publisher: PublisherInfo | null;
  credits: number;
  wallet: WalletInfo | null;
  evmWallet: WalletInfo | null;
  balances: Balances | null;
  loading: boolean;
  signedIn: boolean;
  refresh: () => Promise<void>;
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

  const refresh = useCallback(async () => {
    try {
      setState(await authApi.me());
    } catch {
      setState({ user: null, credits: 0, wallet: null, evmWallet: null, balances: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
    setState({ user: null, credits: 0, wallet: null, evmWallet: null, balances: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      publisher: state.publisher || null,
      credits: state.credits ?? 0,
      wallet: state.wallet,
      evmWallet: state.evmWallet,
      balances: state.balances,
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
