'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Shield,
  Mail,
  ArrowLeft,
  Fuel,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Zap,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/auth';
import { creditsApi, CreditsOverview } from '../api/credits';
import TopUpPanel from '../credits/TopUpPanel';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';

const KIND_LABEL: Record<string, string> = {
  RECHARGE: 'Top-up',
  SPEND: 'API call',
  REFUND: 'Refund',
  ADJUST: 'Adjustment',
};

export default function Profile() {
  const router = useRouter();
  const { user, wallet, evmWallet, loading, signedIn, openSignIn } = useAuth();
  const [overview, setOverview] = useState<CreditsOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAlgo, setCopiedAlgo] = useState(false);
  const [copiedEvm, setCopiedEvm] = useState(false);
  const [copiedSolana, setCopiedSolana] = useState(false);
  const [copiedStellar, setCopiedStellar] = useState(false);
  const [copiedFreighter, setCopiedFreighter] = useState(false);
  const [freighterAccount, setFreighterAccount] = useState<string | null>(null);
  const [connectingFreighter, setConnectingFreighter] = useState(false);
  const [freighterError, setFreighterError] = useState<string | null>(null);
  const [activatingAlgo, setActivatingAlgo] = useState(false);
  const [algoStatusMessage, setAlgoStatusMessage] = useState<string | null>(null);

  const handleActivateAlgo = async () => {
    setActivatingAlgo(true);
    setAlgoStatusMessage(null);
    try {
      await authApi.activateWallet();
      await load();
      setAlgoStatusMessage(
        'Algorand wallet successfully activated and opted into USDC (ASA 10458941)!',
      );
    } catch (err) {
      setAlgoStatusMessage(
        err instanceof Error
          ? err.message
          : 'Activation failed. Please fund at least 0.1 testnet ALGO to this address first.',
      );
    } finally {
      setActivatingAlgo(false);
    }
  };

  const handleConnectFreighter = async () => {
    setFreighterError(null);
    setConnectingFreighter(true);
    try {
      const { connectFreighterWallet } = await import('../wallet/freighterWallet');
      const addr = await connectFreighterWallet();
      setFreighterAccount(addr);
    } catch (err) {
      setFreighterError(err instanceof Error ? err.message : 'Could not connect Freighter wallet');
    } finally {
      setConnectingFreighter(false);
    }
  };

  const [transferringFreighter, setTransferringFreighter] = useState(false);
  const [freighterSuccess, setFreighterSuccess] = useState<string | null>(null);

  const handleDisconnectFreighter = () => {
    setFreighterAccount(null);
    setFreighterError(null);
    setFreighterSuccess(null);
  };

  const handleFundFromFreighter = async () => {
    if (!freighterAccount || !overview?.stellarWalletAddress) return;
    setFreighterError(null);
    setFreighterSuccess(null);
    setTransferringFreighter(true);
    try {
      const { payUsdcWithFreighter } = await import('../wallet/freighterWallet');
      const res = await payUsdcWithFreighter({
        payerAddress: freighterAccount,
        recipientAddress: overview.stellarWalletAddress,
        amountUsdc: 5,
        isMainnet: false,
      });
      setFreighterSuccess(
        `Transferred 5 USDC directly to your generated address! (Tx: ${res.txHash.slice(0, 8)}…)`,
      );
      load();
    } catch (err) {
      setFreighterError(err instanceof Error ? err.message : 'Transfer from Freighter failed');
    } finally {
      setTransferringFreighter(false);
    }
  };

  const copyFreighter = () => {
    if (freighterAccount) {
      navigator.clipboard.writeText(freighterAccount);
      setCopiedFreighter(true);
      setTimeout(() => setCopiedFreighter(false), 2000);
    }
  };

  const copyAlgo = () => {
    const addr = wallet?.address || overview?.walletAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedAlgo(true);
      setTimeout(() => setCopiedAlgo(false), 2000);
    }
  };

  const copyEvm = () => {
    const addr = evmWallet?.address || overview?.evmWalletAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 2000);
    }
  };

  const copySolana = () => {
    const addr = overview?.solanaWalletAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedSolana(true);
      setTimeout(() => setCopiedSolana(false), 2000);
    }
  };

  const copyStellar = () => {
    const addr = overview?.stellarWalletAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedStellar(true);
      setTimeout(() => setCopiedStellar(false), 2000);
    }
  };

  const load = useCallback(async () => {
    if (!signedIn) return;
    setRefreshing(true);
    try {
      setOverview(await creditsApi.overview());
    } catch {
      setOverview(null);
    } finally {
      setRefreshing(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size={32} className="text-main" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="max-w-[560px] mx-auto p-8 text-center">
        <Shield size={32} className="mx-auto mb-4 text-muted" />
        <h1 className="text-2xl mb-2 text-main">Sign in to view your account</h1>
        <p className="text-muted mb-6">
          Buy credit once, then call any API on the marketplace without touching a wallet again.
        </p>
        <button
          type="button"
          onClick={openSignIn}
          className="bg-main text-bg px-4 py-2 rounded-md border-0 cursor-pointer font-medium"
        >
          Sign in
        </button>
      </div>
    );
  }

  const panel = 'rounded-lg border border-border bg-panel p-5 mb-5';
  const algoAddr = wallet?.address || overview?.walletAddress;
  const evmAddr = evmWallet?.address || overview?.evmWalletAddress;

  return (
    <div className="max-w-[720px] mx-auto p-8">
      <button
        type="button"
        onClick={() => router.push('/')}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-main bg-transparent border-0 cursor-pointer p-0 mb-6"
      >
        <ArrowLeft size={13} /> Back to marketplace
      </button>

      <h1 className="text-3xl mb-8 text-main">Account</h1>

      {/* Total Credit Balance */}
      <div className={panel}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base m-0 text-main">Total platform balance</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-main bg-transparent border-0 cursor-pointer"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-mono text-4xl text-main">
            {(overview?.balance ?? 0).toFixed(2)}
          </span>
          <span className="text-muted">{overview?.currency || 'USDC'}</span>
        </div>
        <p className="text-xs text-muted m-0">
          Universal credit balance valid across all monetized APIs on every supported chain.
        </p>
      </div>

      {/* Chain-wise Balances */}
      <div className={panel}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-muted" />
            <h2 className="text-base m-0 text-main">Chain-wise balances</h2>
          </div>
          <span className="text-[11px] text-muted font-mono">
            {overview?.chainBalances?.length || 0} networks active
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          On-chain USDC and native gas held in your dedicated custodial wallets across each network.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(overview?.chainBalances || []).map(cb => (
            <div
              key={cb.chain}
              className="p-3.5 rounded-md bg-bg border border-border flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-main">{cb.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-border text-muted font-mono uppercase">
                  {cb.family}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2.5">
                <div>
                  <span className="font-mono text-lg font-medium text-main">
                    {cb.usdcBalance.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted ml-1">USDC</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-muted">
                    {cb.nativeBalance.toFixed(4)} {cb.nativeSymbol}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                <span className="font-mono text-muted truncate max-w-[170px]" title={cb.address}>
                  {cb.address.slice(0, 8)}…{cb.address.slice(-6)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(cb.address);
                    }}
                    className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                    title="Copy Address"
                  >
                    <Copy size={11} />
                  </button>
                  <a
                    href={cb.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-muted hover:text-main border border-border bg-panel"
                    title="View on Explorer"
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TopUpPanel overview={overview} onCredited={load} />

      {/* Custodial Wallets */}
      <div className={panel}>
        <div className="flex items-center gap-3 mb-4">
          <Wallet size={16} className="text-muted" />
          <h2 className="text-base m-0 text-main">Custodial Wallets</h2>
        </div>
        <p className="text-xs text-muted mb-4">
          Dedicated addresses provisioned for your account. Automatically funded from the platform
          treasury upon top-up.
        </p>

        {/* EVM Wallet */}
        <div className="p-3.5 rounded-md bg-bg border border-border mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-main">EVM Custodial Wallet</span>
            <span className="text-[10px] text-muted uppercase">
              Base Sepolia / Sepolia / Arbitrum / OP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-main break-all flex-1 select-all">
              {evmAddr || 'Generating EVM wallet…'}
            </span>
            {evmAddr && (
              <>
                <button
                  type="button"
                  onClick={copyEvm}
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                  title="Copy EVM Address"
                >
                  {copiedEvm ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
                <a
                  href={overview?.explorerUrls?.evm || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel"
                  title="View on Explorer"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Algorand Wallet */}
        <div className="p-3.5 rounded-md bg-bg border border-border mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-main">Algorand Custodial Wallet</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  wallet?.optedIn
                    ? 'text-success bg-success/10 border-success/30'
                    : 'text-warning bg-warning/10 border-warning/30'
                }`}
              >
                {wallet?.optedIn ? 'Opted In' : 'Opt-In Needed'}
              </span>
              <span className="text-[10px] text-muted uppercase">Algorand Testnet</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-main break-all flex-1 select-all">
              {algoAddr || 'Generating Algorand wallet…'}
            </span>
            {algoAddr && (
              <>
                <button
                  type="button"
                  onClick={copyAlgo}
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                  title="Copy Algorand Address"
                >
                  {copiedAlgo ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
                <a
                  href={overview?.explorerUrls?.algorand || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel"
                  title="View on Explorer"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>

          {algoStatusMessage && <p className="text-xs text-muted mt-2 mb-1">{algoStatusMessage}</p>}

          {!wallet?.optedIn && algoAddr && (
            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted">
                Must opt into ASA 10458941 (USDC) to receive deposits.
              </span>
              <button
                type="button"
                onClick={handleActivateAlgo}
                disabled={activatingAlgo}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel hover:bg-panel-hover border border-border text-xs text-main cursor-pointer disabled:opacity-50"
              >
                {activatingAlgo ? <Spinner size={12} /> : <Zap size={12} />}
                Auto Opt-In to USDC
              </button>
            </div>
          )}
        </div>

        {/* Solana Wallet */}
        <div className="p-3.5 rounded-md bg-bg border border-border mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-main">Solana Custodial Wallet</span>
            <span className="text-[10px] text-muted uppercase">Solana Devnet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-main break-all flex-1 select-all">
              {overview?.solanaWalletAddress || 'Generating Solana wallet…'}
            </span>
            {overview?.solanaWalletAddress && (
              <>
                <button
                  type="button"
                  onClick={copySolana}
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                  title="Copy Solana Address"
                >
                  {copiedSolana ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
                <a
                  href={
                    overview?.explorerUrls?.solana ||
                    `https://explorer.solana.com/address/${overview.solanaWalletAddress}?cluster=devnet`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel"
                  title="View on Explorer"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Stellar Wallet */}
        <div className="p-3.5 rounded-md bg-bg border border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-main">Stellar Custodial Wallet</span>
            <span className="text-[10px] text-muted uppercase">Stellar Testnet / Soroban</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-xs text-main break-all flex-1 select-all">
              {overview?.stellarWalletAddress || 'Generating Stellar wallet…'}
            </span>
            {overview?.stellarWalletAddress && (
              <>
                <button
                  type="button"
                  onClick={copyStellar}
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                  title="Copy Stellar Address"
                >
                  {copiedStellar ? (
                    <Check size={13} className="text-success" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
                <a
                  href={
                    overview?.explorerUrls?.stellar ||
                    `https://stellar.expert/explorer/testnet/account/${overview.stellarWalletAddress}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted hover:text-main border border-border bg-panel"
                  title="View on Explorer"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>

          {/* Connect Freighter Section */}
          <div className="pt-2.5 border-t border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Wallet size={13} />
                <span>Freighter Wallet:</span>
              </div>
              {freighterAccount ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
                    {freighterAccount.slice(0, 4)}…{freighterAccount.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={copyFreighter}
                    className="p-1 rounded text-muted hover:text-main border border-border bg-panel cursor-pointer"
                    title="Copy Freighter Address"
                  >
                    {copiedFreighter ? (
                      <Check size={12} className="text-success" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectFreighter}
                    className="text-[11px] text-muted hover:text-danger cursor-pointer ml-1 underline"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleConnectFreighter}
                  isLoading={connectingFreighter}
                  className="text-xs h-7 px-2.5"
                >
                  <Zap size={12} className="mr-1" /> Connect Freighter Wallet
                </Button>
              )}
            </div>
            {freighterError && (
              <p className="text-[11px] text-danger mt-1.5 leading-tight">{freighterError}</p>
            )}
            {freighterSuccess && (
              <p className="text-[11px] text-success mt-1.5 leading-tight flex items-center gap-1 font-mono">
                <Check size={12} /> {freighterSuccess}
              </p>
            )}
            {freighterAccount && (
              <div className="mt-3 p-3 rounded bg-panel border border-border">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs font-medium text-main block">
                      Fund Generated Wallet
                    </span>
                    <span className="text-[11px] text-muted block">
                      Transfer 5 USDC from your connected Freighter wallet directly to your
                      custodial address.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleFundFromFreighter}
                    isLoading={transferringFreighter}
                    disabled={transferringFreighter || !overview?.stellarWalletAddress}
                    className="text-xs h-7"
                  >
                    <Zap size={12} className="mr-1" /> Transfer 5 USDC
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="flex items-center gap-3 mb-4">
          <Mail size={16} className="text-muted" />
          <h2 className="text-base m-0 text-main">Identity</h2>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted">Email</span>
          <span className="text-main">{user?.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Sign-in methods</span>
          <span className="text-main">
            {(user?.authProviders || [])
              .map(p => ({ google: 'Google', magic_link: 'Magic link', otp: 'Email code' })[p] || p)
              .join(', ')}
          </span>
        </div>
      </div>

      <div className={panel}>
        <h2 className="text-base m-0 mb-4 text-main">Activity</h2>
        {overview?.history.length ? (
          <div className="flex flex-col">
            {overview.history.map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0 gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-main m-0 truncate">
                    {entry.description || KIND_LABEL[entry.kind] || entry.kind}
                  </p>
                  <p className="text-[0.7rem] text-muted m-0">
                    {KIND_LABEL[entry.kind] || entry.kind} ·{' '}
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-sm ${
                      entry.amount >= 0 ? 'text-success' : 'text-main'
                    }`}
                  >
                    {entry.amount >= 0 ? '+' : ''}
                    {entry.amount.toFixed(6)}
                  </span>
                  <p className="text-[0.7rem] text-muted m-0 font-mono">
                    {entry.balance_after.toFixed(6)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted m-0">
            Nothing yet. Add credit above to start calling APIs.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <Fuel size={15} className="text-muted mt-0.5 shrink-0" />
          <p className="text-xs text-muted m-0 leading-relaxed">
            Every API call settles as a real Algorand transaction, paid from the platform&apos;s
            custody account and deducted from your credit. The x402 facilitator covers the network
            fee, so you never hold ALGO and never approve a transaction after your top-up.
          </p>
        </div>
      </div>
    </div>
  );
}
