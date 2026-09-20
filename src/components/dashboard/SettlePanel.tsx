'use client';

import { apiErrorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { ExternalLink, Wallet, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Spinner } from '../common/Spinner';

interface Props {
  publisherId: string;
  available: number;
  onSettled: () => void;
}

/**
 * Pays the publisher's outstanding balance to their own external address.
 *
 * Vendors never hold a wallet on this platform — earnings accrue as a balance and this is
 * the way out of it, so the amount at risk on the platform is whatever they choose to leave.
 */
/**
 * Refusals the backend makes before it moves any money: nothing is due, no payout address is
 * set, the balance is under the publisher's own minimum. Pressing the button again after one
 * of these cannot pay twice, so the button comes back.
 *
 * Anything else, including a `FAILED` transfer and a request that never returned, leaves the
 * outcome unknown to this page. `POST /dashboard/:id/settle` takes no idempotency key
 * (`Spigot-Algorand/backend/src/routes/dashboard.ts:154`), so a second press after a timeout
 * is a second payout. The button stays down and the publisher is told to reload first.
 */
const SAFE_TO_RETRY = ['NOTHING_DUE', 'NO_WALLET', 'BELOW_MINIMUM'];

const refusedBeforePaying = (err: unknown): boolean => {
  const body = (err as { body?: { status?: unknown } } | null)?.body;
  return typeof body?.status === 'string' && SAFE_TO_RETRY.includes(body.status);
};

const shorten = (address: string): string =>
  address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address;

const SettlePanel: React.FC<Props> = ({ publisherId, available, onSettled }) => {
  const [busy, setBusy] = useState(false);
  // Latched when a payout's outcome is unknown. Only a reload clears it.
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    explorerUrl?: string;
  } | null>(null);

  const handleSettle = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await apiClient.settle(publisherId);
      const paidTo = response.walletAddress
        ? shorten(response.walletAddress)
        : 'your payout address';
      setResult({
        ok: true,
        message: `Paid $${Number(response.settlement?.amount ?? 0).toFixed(6)} to ${paidTo}.`,
        explorerUrl: response.explorerUrl,
      });
      onSettled();
    } catch (err) {
      const unknown = !refusedBeforePaying(err);
      setOutcomeUnknown(unknown);
      setResult({
        ok: false,
        message: unknown
          ? `${apiErrorMessage(err, 'Settlement failed')} Reload this page before trying again: this payout may still have been sent, and a second attempt would send it twice.`
          : apiErrorMessage(err, 'Settlement failed'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-panel p-5 mb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Wallet size={18} className="text-muted" />
          <div>
            <h3 className="text-base m-0 text-main">Withdraw your earnings</h3>
            <p className="text-xs text-muted m-0 mt-1">
              Sends your full available balance to the payout address on your account.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSettle}
          disabled={busy || outcomeUnknown || available <= 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && <Spinner size={15} />}
          {outcomeUnknown
            ? 'Reload to check'
            : available > 0
              ? `Withdraw $${available.toFixed(4)}`
              : 'Nothing to withdraw'}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 px-4 py-3 rounded-md flex items-start gap-2 border text-sm ${
            result.ok
              ? 'bg-panel-hover border-border text-main'
              : 'bg-error/10 border-error/40 text-error'
          }`}
        >
          {result.ok ? (
            <CheckCircle size={15} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
          )}
          <div>
            <span>{result.message}</span>
            {result.explorerUrl && (
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 underline text-main"
              >
                View transaction <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlePanel;
