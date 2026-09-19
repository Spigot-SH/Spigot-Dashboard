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
const SettlePanel: React.FC<Props> = ({ publisherId, available, onSettled }) => {
  const [busy, setBusy] = useState(false);
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
      setResult({
        ok: true,
        message: `Paid ${Number(response.settlement?.amount ?? 0).toFixed(6)} USDC to your payout address.`,
        explorerUrl: response.explorerUrl,
      });
      onSettled();
    } catch (err) {
      // The endpoint distinguishes nothing-due, no-wallet, below-minimum and failure.
      setResult({
        ok: false,
        message: apiErrorMessage(err, 'Settlement failed'),
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
          disabled={busy || available <= 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && <Spinner size={15} />}
          {available > 0 ? `Withdraw ${available.toFixed(4)} USDC` : 'Nothing to withdraw'}
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
