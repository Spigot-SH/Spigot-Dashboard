'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { creditsApi, CreditsOverview } from '../api/credits';
import { apiErrorMessage } from '../lib/errors';
import { formatCredit, UNKNOWN } from '../lib/format';
import TopUpPanel from '../credits/TopUpPanel';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';

const KIND_LABEL: Record<string, string> = {
  RECHARGE: 'Top-up',
  SPEND: 'API call',
  REFUND: 'Refund',
  ADJUST: 'Adjustment',
};

const SIGN_IN_LABEL: Record<string, string> = {
  google: 'Google',
  magic_link: 'Magic link',
  otp: 'Email code',
};

const panel = 'rounded-lg border border-border bg-panel p-5 mb-5';

/**
 * The account page: what you have, how to add more, and what it has been spent on.
 *
 * There is no chain on this page, and that is the point. It used to open with nine
 * "chain-wise balance" cards and four custodial wallet addresses; those were folded into a
 * disclosure and are now gone outright. A caller pays, the backend credits their ledger, and
 * where the funds actually sit is Spigot's problem, not theirs. Naming the networks told them
 * something they cannot act on and cannot withdraw from, and `overview.chainBalances` is still
 * served by the backend for whoever needs to debug it.
 */
export default function Profile() {
  const router = useRouter();
  const { user, loading, signedIn, openSignIn } = useAuth();
  const [overview, setOverview] = useState<CreditsOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!signedIn) return;
    setRefreshing(true);
    try {
      setOverview(await creditsApi.overview());
      setLoadError(null);
    } catch (e: unknown) {
      // A failed load is not an empty account. This page used to print "$0.00 available" when
      // the request failed, which reads as the account's real state. Never fall back to zeros.
      setOverview(null);
      setLoadError(apiErrorMessage(e, 'Could not load your account.'));
    } finally {
      setRefreshing(false);
      setLoadingOverview(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={32} className="text-main" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-[560px] p-8 text-center">
        <Shield size={32} className="mx-auto mb-4 text-muted" />
        <h1 className="mb-2 text-2xl text-main">Sign in to view your account</h1>
        <p className="mb-6 text-muted">
          Add credit once, then call any API without touching a wallet again.
        </p>
        <Button type="button" onClick={openSignIn}>
          Sign in
        </Button>
      </div>
    );
  }

  const history = overview?.history ?? [];

  return (
    <div className="mx-auto max-w-[720px] p-8">
      <button
        type="button"
        onClick={() => router.push('/')}
        className="mb-6 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-muted hover:text-main"
      >
        <ArrowLeft size={13} /> Back to the console
      </button>

      <h1 className="mb-8 text-3xl text-main">Account</h1>

      <div className={panel}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-base text-main">Your balance</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-xs text-muted hover:text-main"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loadingOverview ? (
          <div className="h-10 w-40 animate-pulse rounded bg-bg" />
        ) : loadError ? (
          <p
            role="alert"
            className="m-0 flex items-start gap-2 rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {loadError} No figures are shown, because none loaded.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl text-main">
                {formatCredit(overview?.balance ?? 0)}
              </span>
              <span className="text-muted">available</span>
            </div>
            <p className="m-0 text-xs text-muted">
              One balance, spent by every API you call. It never expires.
            </p>
          </>
        )}
      </div>

      <TopUpPanel overview={overview} onCredited={load} />

      <div className={panel}>
        <h2 className="m-0 mb-4 text-base text-main">Activity</h2>
        {loadingOverview ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(n => (
              <div key={n} className="h-9 animate-pulse rounded bg-bg" />
            ))}
          </div>
        ) : loadError ? (
          <p className="m-0 text-sm text-muted">Your activity could not be loaded.</p>
        ) : history.length ? (
          <div className="flex flex-col">
            {history.map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm text-main">
                    {entry.description || KIND_LABEL[entry.kind] || entry.kind}
                  </p>
                  <p className="m-0 text-[0.7rem] text-muted">
                    {KIND_LABEL[entry.kind] || entry.kind} ·{' '}
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`font-mono text-sm ${entry.amount >= 0 ? 'text-success' : 'text-main'}`}
                  >
                    {entry.amount >= 0 ? '+' : '−'}${Math.abs(entry.amount).toFixed(4)}
                  </span>
                  <p className="m-0 font-mono text-[0.7rem] text-muted">
                    ${entry.balance_after.toFixed(4)} after
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">Nothing yet. Add credit above to start calling.</p>
        )}
      </div>

      <div className={panel}>
        <h2 className="m-0 mb-4 text-base text-main">Sign-in</h2>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted">Email</span>
          <span className="text-main">{user?.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Methods</span>
          <span className="text-main">
            {(user?.authProviders || []).map(p => SIGN_IN_LABEL[p] || p).join(', ') || UNKNOWN}
          </span>
        </div>
      </div>
    </div>
  );
}
