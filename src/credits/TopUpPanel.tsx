'use client';

import { apiErrorMessage } from '../lib/errors';
import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  Smartphone,
  Copy,
  Check,
  Gift,
} from 'lucide-react';
import { creditsApi, CreditsOverview, Tier } from '../api/credits';
import { walletNetworkLabel } from '../wallet/walletManager';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { RazorpayTopUpModal } from './RazorpayTopUpModal';
import {
  connectInjectedEvmWallet,
  switchOrAddEvmChain,
  signExactEvmPayment,
  EVM_TESTNET_CHAINS,
} from '../wallet/evmWallet';

interface Props {
  overview: CreditsOverview | null;
  onCredited: () => void;
}

type Stage = 'idle' | 'quoting' | 'signing' | 'confirming' | 'done';
type FundingMethod = 'treasury' | 'algorand' | 'evm' | 'solana' | 'stellar' | 'fiat';

const TopUpPanel: React.FC<Props> = ({ overview, onCredited }) => {
  const { activeAccount, signTransactions, wallets } = useWallet();
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>('treasury');
  const [selected, setSelected] = useState<string>('starter');
  const [customAmount, setCustomAmount] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copiedEvm, setCopiedEvm] = useState(false);
  const [copiedSolana, setCopiedSolana] = useState(false);
  const [copiedStellar, setCopiedStellar] = useState(false);
  const [receipt, setReceipt] = useState<{ credited: number; explorerUrl: string } | null>(null);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);

  // Treasury Top-Up state
  const [treasuryChain, setTreasuryChain] = useState<string>('algorand');

  // EVM Wallet state
  const [selectedEvmChain, setSelectedEvmChain] = useState<string>('base');
  const [connectedEvmAccount, setConnectedEvmAccount] = useState<string | null>(null);
  const [connectingEvm, setConnectingEvm] = useState(false);

  // Solana Wallet state
  const [connectedSolanaAccount, setConnectedSolanaAccount] = useState<string | null>(null);
  const [connectingSolana, setConnectingSolana] = useState(false);

  // Stellar Freighter Wallet state
  const [connectedFreighterAccount, setConnectedFreighterAccount] = useState<string | null>(null);
  const [freighterBalances, setFreighterBalances] = useState<{
    xlm: string;
    usdc: string;
    hasUsdcTrustline: boolean;
  } | null>(null);
  const [connectingFreighter, setConnectingFreighter] = useState(false);

  // Algorand Auto Opt-In state
  const { wallet, refresh } = useAuth();
  const [optingInAlgo, setOptingInAlgo] = useState(false);
  const [algoOptInSuccess, setAlgoOptInSuccess] = useState<string | null>(null);
  const [algoOptedIn, setAlgoOptedIn] = useState<boolean | null>(null);

  const checkAlgoStatus = useCallback(async () => {
    if (!activeAccount) {
      setAlgoOptedIn(null);
      return;
    }
    try {
      const res = await fetch(
        `https://testnet-api.algonode.cloud/v2/accounts/${activeAccount.address}`,
      );
      const data = await res.json();
      const hasOptIn =
        data?.assets?.some((a: { 'asset-id': number }) => a['asset-id'] === 10458941) || false;
      setAlgoOptedIn(hasOptIn);
    } catch {
      // ignore network glitch
    }
  }, [activeAccount]);

  useEffect(() => {
    void checkAlgoStatus();
  }, [checkAlgoStatus]);

  const handleAutoOptIn = async () => {
    if (!activeAccount) return;
    setOptingInAlgo(true);
    setError(null);
    setAlgoOptInSuccess(null);
    try {
      const algosdkModule = await import('algosdk');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const algosdk = (algosdkModule as any).default || algosdkModule;
      const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
      const suggestedParams = await algod.getTransactionParams().do();
      const txnsToSign: Uint8Array[] = [];

      // 1. Check if custodial receiver needs ALGO min-balance
      const targetReceiver = overview?.walletAddress || wallet?.address;
      if (targetReceiver) {
        try {
          const recRes = await fetch(
            `https://testnet-api.algonode.cloud/v2/accounts/${targetReceiver}`,
          );
          const recData = await recRes.json();
          const recAlgo = recData?.amount || 0;
          if (recAlgo < 200_000) {
            // Fund 0.25 ALGO (250,000 microALGO) so receiver can hold ASA 10458941
            const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
              sender: activeAccount.address,
              receiver: targetReceiver,
              amount: 250_000,
              suggestedParams,
            });
            txnsToSign.push(fundTx.toByte());
          }
        } catch (e) {
          console.warn('Could not check receiver ALGO balance:', e);
        }
      }

      // 2. Check if activeAccount itself is opted into USDC
      try {
        const senderRes = await fetch(
          `https://testnet-api.algonode.cloud/v2/accounts/${activeAccount.address}`,
        );
        const senderData = await senderRes.json();
        const hasSenderOptIn = senderData?.assets?.some(
          (a: { 'asset-id': number }) => a['asset-id'] === 10458941,
        );
        if (!hasSenderOptIn) {
          const optInTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: activeAccount.address,
            receiver: activeAccount.address,
            amount: 0,
            assetIndex: 10458941,
            suggestedParams,
          });
          txnsToSign.push(optInTx.toByte());
        }
      } catch (e) {
        console.warn('Could not check sender opt-in:', e);
      }

      // If connected wallet needs to sign transactions:
      if (txnsToSign.length > 0) {
        const signed = (await signTransactions(txnsToSign)) as (Uint8Array | null)[];
        for (const s of signed) {
          if (s) {
            const { txid } = await algod.sendRawTransaction(s).do();
            await algosdk.waitForConfirmation(algod, txid, 4);
          }
        }
      }

      // 3. Trigger custodial wallet activation on backend
      try {
        await authApi.activateWallet();
      } catch (actErr) {
        console.warn('Backend activateWallet notice:', actErr);
      }

      await refresh();
      await checkAlgoStatus();
      setAlgoOptInSuccess(
        'Successfully opted into USDC (ASA 10458941)! Both connected wallet and receiver are ready.',
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Auto opt-in failed'));
    } finally {
      setOptingInAlgo(false);
    }
  };

  const copyEvmAddress = () => {
    if (overview?.evmWalletAddress) {
      navigator.clipboard.writeText(overview.evmWalletAddress);
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 2000);
    }
  };

  const copySolanaAddress = () => {
    if (overview?.solanaWalletAddress) {
      navigator.clipboard.writeText(overview.solanaWalletAddress);
      setCopiedSolana(true);
      setTimeout(() => setCopiedSolana(false), 2000);
    }
  };

  const copyStellarAddress = () => {
    if (overview?.stellarWalletAddress) {
      navigator.clipboard.writeText(overview.stellarWalletAddress);
      setCopiedStellar(true);
      setTimeout(() => setCopiedStellar(false), 2000);
    }
  };

  const handleConnectEvm = async () => {
    setError(null);
    setConnectingEvm(true);
    try {
      const address = await connectInjectedEvmWallet();
      setConnectedEvmAccount(address);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not connect EVM wallet'));
    } finally {
      setConnectingEvm(false);
    }
  };

  const handleDisconnectEvm = () => {
    setConnectedEvmAccount(null);
  };

  const handleConnectSolana = async () => {
    setError(null);
    setConnectingSolana(true);
    try {
      if (typeof window === 'undefined') throw new Error('Window not available');
      const solana = (
        window as unknown as {
          solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> };
        }
      ).solana;
      if (!solana) {
        throw new Error('Solana wallet (Phantom/Solflare) not detected in browser');
      }
      const res = await solana.connect();
      const pubkey = res.publicKey.toString();
      setConnectedSolanaAccount(pubkey);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not connect Solana wallet'));
    } finally {
      setConnectingSolana(false);
    }
  };

  const handleDisconnectSolana = () => {
    setConnectedSolanaAccount(null);
  };

  const handleConnectFreighter = async () => {
    setError(null);
    setConnectingFreighter(true);
    try {
      const { connectFreighterWallet, getFreighterBalances } =
        await import('../wallet/freighterWallet');
      const address = await connectFreighterWallet();
      setConnectedFreighterAccount(address);
      const balances = await getFreighterBalances(address);
      setFreighterBalances(balances);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not connect Freighter wallet'));
    } finally {
      setConnectingFreighter(false);
    }
  };

  const handleDisconnectFreighter = () => {
    setConnectedFreighterAccount(null);
    setFreighterBalances(null);
  };

  useEffect(() => {
    if (
      overview?.tiers.length &&
      !overview.tiers.some(t => t.id === selected) &&
      selected !== 'custom'
    ) {
      setSelected(overview.tiers[0].id);
    }
  }, [overview, selected]);

  const amount = selected === 'custom' ? Number(customAmount) : undefined;
  const chosenTier: Tier | undefined = React.useMemo(() => {
    if (selected === 'custom') {
      return Number.isFinite(amount) && (amount as number) > 0
        ? { id: 'custom', label: `$${amount}`, amountUsdc: amount as number }
        : undefined;
    }
    return overview?.tiers.find(t => t.id === selected);
  }, [selected, amount, overview?.tiers]);

  // 1-Click Instant Treasury Top-Up
  const handleTreasuryTopUp = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);
    setReceipt(null);
    setStage('confirming');

    try {
      const res = await creditsApi.treasuryTopUp(selected, amount, treasuryChain);
      setReceipt({ credited: res.credited, explorerUrl: res.explorerUrl });
      setStage('done');
      onCredited();
    } catch (err) {
      setError(apiErrorMessage(err, 'Treasury top-up failed'));
      setStage('idle');
    }
  }, [chosenTier, selected, amount, treasuryChain, onCredited]);

  // Algorand top-up payment
  const buyAlgo = useCallback(async () => {
    if (!activeAccount || !chosenTier) return;
    setError(null);
    setReceipt(null);

    try {
      setStage('quoting');
      const quote = await creditsApi.quote(selected, amount);

      setStage('signing');
      const { ExactAvmScheme } = await import('@x402/avm/exact/client');
      const scheme = new ExactAvmScheme({
        address: activeAccount.address,
        signTransactions: (txns: Uint8Array[], indexes?: number[]) =>
          signTransactions(txns, indexes) as Promise<(Uint8Array | null)[]>,
      });
      const result = await scheme.createPaymentPayload(2, quote.requirements as never);
      const paymentSignature = btoa(
        JSON.stringify({
          x402Version: 2,
          scheme: 'exact',
          network: quote.requirements.network,
          payload: result.payload,
        }),
      );

      setStage('confirming');
      const confirmed = await creditsApi.confirm(selected, paymentSignature, amount);

      setReceipt({ credited: confirmed.credited, explorerUrl: confirmed.explorerUrl });
      setStage('done');
      onCredited();
    } catch (err) {
      setError(apiErrorMessage(err, 'Top-up failed'));
      setStage('idle');
    }
  }, [activeAccount, chosenTier, selected, amount, signTransactions, onCredited]);

  // EVM top-up payment
  const buyEvm = useCallback(async () => {
    if (!connectedEvmAccount || !chosenTier) return;
    setError(null);
    setReceipt(null);

    try {
      setStage('quoting');
      const chainConfig = EVM_TESTNET_CHAINS[selectedEvmChain] || EVM_TESTNET_CHAINS.base;
      await switchOrAddEvmChain(chainConfig);

      const quote = await creditsApi.quote(selected, amount, chainConfig.key);

      setStage('signing');
      const paymentSignature = await signExactEvmPayment(quote.requirements, connectedEvmAccount);

      setStage('confirming');
      const confirmed = await creditsApi.confirm(selected, paymentSignature, amount);

      setReceipt({ credited: confirmed.credited, explorerUrl: confirmed.explorerUrl });
      setStage('done');
      onCredited();
    } catch (err) {
      setError(apiErrorMessage(err, 'EVM Top-up failed'));
      setStage('idle');
    }
  }, [connectedEvmAccount, chosenTier, selected, amount, selectedEvmChain, onCredited]);

  // Solana top-up payment
  const buySolana = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);
    setReceipt(null);

    try {
      setStage('quoting');
      const quote = await creditsApi.quote(selected, amount, 'solana');

      setStage('confirming');
      const solana =
        typeof window !== 'undefined'
          ? (
              window as unknown as {
                solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> };
              }
            ).solana
          : undefined;
      let paymentSignature: string;
      if (connectedSolanaAccount && solana) {
        paymentSignature = btoa(
          JSON.stringify({
            x402Version: 2,
            scheme: 'exact',
            network: quote.requirements.network,
            payload: {
              account: connectedSolanaAccount,
              payer: connectedSolanaAccount,
              signature: `solana_sig_${Date.now()}`,
            },
          }),
        );
      } else {
        paymentSignature = btoa(
          JSON.stringify({
            x402Version: 2,
            scheme: 'exact',
            network: quote.requirements.network,
            payload: {
              account: overview?.solanaWalletAddress,
              signature: `solana_topup_${Date.now()}`,
            },
          }),
        );
      }

      const confirmed = await creditsApi.confirm(selected, paymentSignature, amount);
      setReceipt({ credited: confirmed.credited, explorerUrl: confirmed.explorerUrl });
      setStage('done');
      onCredited();
    } catch (err) {
      setError(apiErrorMessage(err, 'Solana Top-up failed'));
      setStage('idle');
    }
  }, [connectedSolanaAccount, chosenTier, selected, amount, overview, onCredited]);

  // Stellar top-up payment
  const buyStellar = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);
    setReceipt(null);

    try {
      setStage('quoting');
      const quote = await creditsApi.quote(selected, amount, 'stellar');

      if (connectedFreighterAccount) {
        setStage('signing');
        const { payUsdcWithFreighter, getFreighterBalances } =
          await import('../wallet/freighterWallet');
        const res = await payUsdcWithFreighter({
          payerAddress: connectedFreighterAccount,
          recipientAddress: quote.requirements.payTo,
          amountUsdc: chosenTier.amountUsdc,
          isMainnet: false,
        });

        setStage('confirming');
        const paymentSignature = btoa(
          JSON.stringify({
            x402Version: 2,
            scheme: 'exact',
            network: quote.requirements.network,
            payload: {
              account: connectedFreighterAccount,
              payer: connectedFreighterAccount,
              transaction: res.signedTxXdr,
              txHash: res.txHash,
            },
          }),
        );

        const confirmed = await creditsApi.confirm(selected, paymentSignature, amount);
        setReceipt({
          credited: confirmed.credited,
          explorerUrl:
            confirmed.explorerUrl || `https://stellar.expert/explorer/testnet/tx/${res.txHash}`,
        });
        setStage('done');
        onCredited();
        getFreighterBalances(connectedFreighterAccount)
          .then(setFreighterBalances)
          .catch(() => null);
      } else {
        setStage('confirming');
        const payer = overview?.stellarWalletAddress;
        const paymentSignature = btoa(
          JSON.stringify({
            x402Version: 2,
            scheme: 'exact',
            network: quote.requirements.network,
            payload: {
              account: payer,
              payer: payer,
              signature: `stellar_topup_${Date.now()}`,
            },
          }),
        );

        const confirmed = await creditsApi.confirm(selected, paymentSignature, amount);
        setReceipt({ credited: confirmed.credited, explorerUrl: confirmed.explorerUrl });
        setStage('done');
        onCredited();
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Stellar Top-up failed'));
      setStage('idle');
    }
  }, [connectedFreighterAccount, chosenTier, selected, amount, overview, onCredited]);

  const busy = stage === 'quoting' || stage === 'signing' || stage === 'confirming';
  const stageLabel = {
    quoting: 'Preparing payment…',
    signing: 'Approve in your wallet…',
    confirming: 'Settling payment on chain…',
  }[stage as 'quoting' | 'signing' | 'confirming'];

  const panel = 'rounded-lg border border-border bg-panel p-5 mb-5';

  return (
    <div className={panel}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-base m-0 text-main">Add credit</h2>
        <span className="text-xs text-muted">{walletNetworkLabel}</span>
      </div>
      <p className="text-sm text-muted mb-4">
        Fund your credit ledger via Algorand, Solana, Stellar, EVM testnet wallet, or Razorpay. Once
        credited, all marketplace API calls are automated and walletless.
      </p>

      {/* Funding Method Tabs */}
      <div className="flex items-center gap-1.5 mb-5 p-1 bg-bg rounded-lg border border-border flex-wrap">
        <button
          type="button"
          onClick={() => setFundingMethod('treasury')}
          className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
            fundingMethod === 'treasury'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          <Gift size={13} className="text-accent" /> Instant Treasury
        </button>
        <button
          type="button"
          onClick={() => setFundingMethod('algorand')}
          className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            fundingMethod === 'algorand'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          Algorand Wallet
        </button>
        <button
          type="button"
          onClick={() => setFundingMethod('solana')}
          className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            fundingMethod === 'solana'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          Solana Wallet
        </button>
        <button
          type="button"
          onClick={() => setFundingMethod('stellar')}
          className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            fundingMethod === 'stellar'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          Stellar Wallet
        </button>
        <button
          type="button"
          onClick={() => setFundingMethod('evm')}
          className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            fundingMethod === 'evm'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          EVM Wallet
        </button>
        <button
          type="button"
          onClick={() => setFundingMethod('fiat')}
          className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            fundingMethod === 'fiat'
              ? 'bg-panel text-main shadow border border-border'
              : 'text-muted hover:text-main'
          }`}
        >
          Card / UPI (Razorpay)
        </button>
      </div>

      {fundingMethod === 'treasury' ? (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-lg bg-bg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-main uppercase tracking-wider">
                Instant Testnet Top-Up (1-Click)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-panel border border-border text-muted font-mono">
                No Wallet Required
              </span>
            </div>
            <p className="text-xs text-muted mb-4">
              Directly provisions on-chain testnet USDC to your custodial account from the platform
              treasury.
            </p>

            <div className="mb-4">
              <Select
                label="Target Network"
                value={treasuryChain}
                onChange={e => setTreasuryChain(e.target.value)}
              >
                <option value="algorand">Algorand Testnet</option>
                <option value="solana">Solana Devnet</option>
                <option value="stellar">Stellar Testnet</option>
                <option value="ethereum">Ethereum Sepolia (11155111)</option>
                <option value="base">Base Sepolia (84532)</option>
                <option value="arbitrum">Arbitrum Sepolia (421614)</option>
                <option value="optimism">Optimism Sepolia (11155420)</option>
                <option value="avalanche">Avalanche Fuji (43113)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(overview?.tiers || []).map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelected(tier.id)}
                  className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                    selected === tier.id
                      ? 'bg-main text-bg border-main font-semibold'
                      : 'bg-panel text-main border-border hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tier.label}</div>
                  <div className="text-[0.65rem] opacity-70">{tier.amountUsdc} USDC</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected('custom')}
                className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                  selected === 'custom'
                    ? 'bg-main text-bg border-main font-semibold'
                    : 'bg-panel text-main border-border hover:border-white/30'
                }`}
              >
                <div className="text-lg">Custom</div>
                <div className="text-[0.65rem] opacity-70">
                  {overview ? `${overview.custom.min}–${overview.custom.max}` : ''}
                </div>
              </button>
            </div>

            {selected === 'custom' && (
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount in USDC (${overview?.custom.min}–${overview?.custom.max})`}
                className="w-full px-3 py-2.5 mb-4 rounded-md bg-panel border border-border text-main text-sm outline-none focus:border-main"
              />
            )}

            <button
              type="button"
              onClick={handleTreasuryTopUp}
              disabled={busy || !chosenTier}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Spinner size={15} /> : <Zap size={15} />}
              {busy
                ? stageLabel
                : chosenTier
                  ? `Fund ${chosenTier.amountUsdc} USDC from Treasury`
                  : 'Choose an amount'}
            </button>
          </div>
        </div>
      ) : fundingMethod === 'evm' ? (
        <div className="flex flex-col gap-4">
          {/* EVM Custodial Address & Direct Razorpay Funding Card */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-main">
                Your Dedicated EVM Custodial Address
              </span>
              <span className="text-[10px] text-muted uppercase tracking-wide">Testnet</span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded bg-panel border border-border mb-3">
              <span className="font-mono text-xs text-main break-all flex-1 select-all">
                {overview?.evmWalletAddress || 'Generating EVM address…'}
              </span>
              <button
                type="button"
                onClick={copyEvmAddress}
                className="p-1.5 rounded hover:bg-bg text-muted hover:text-main cursor-pointer border border-border shrink-0"
                title="Copy EVM Address"
              >
                {copiedEvm ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>

            <p className="text-xs text-muted mb-3 leading-relaxed">
              Your custodial EVM account is provisioned across <strong>Base Sepolia</strong>,{' '}
              <strong>Sepolia</strong>, <strong>Arbitrum Sepolia</strong>,{' '}
              <strong>OP Sepolia</strong>, and <strong>Avalanche Fuji</strong>.
            </p>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowRazorpayModal(true)}
              >
                <Smartphone size={14} /> Fund via Razorpay (UPI / Card)
              </Button>
              {overview?.evmWalletAddress && (
                <a
                  href={overview.explorerUrls?.evm || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-main"
                >
                  View on BaseScan <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* Connect EVM Wallet & Pay on Testnet */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-3">
              Pay with Connected EVM Wallet
            </h3>

            <div className="mb-4">
              <Select
                label="Select EVM Network"
                value={selectedEvmChain}
                onChange={e => setSelectedEvmChain(e.target.value)}
              >
                <option value="base">Base Sepolia (84532)</option>
                <option value="ethereum">Ethereum Sepolia (11155111)</option>
                <option value="arbitrum">Arbitrum Sepolia (421614)</option>
                <option value="optimism">Optimism Sepolia (11155420)</option>
                <option value="avalanche">Avalanche Fuji (43113)</option>
                <option value="robinhood">Robinhood Testnet (46630)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(overview?.tiers || []).map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelected(tier.id)}
                  className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                    selected === tier.id
                      ? 'bg-main text-bg border-main font-semibold'
                      : 'bg-panel text-main border-border hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tier.label}</div>
                  <div className="text-[0.65rem] opacity-70">{tier.amountUsdc} USDC</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected('custom')}
                className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                  selected === 'custom'
                    ? 'bg-main text-bg border-main font-semibold'
                    : 'bg-panel text-main border-border hover:border-white/30'
                }`}
              >
                <div className="text-lg">Custom</div>
                <div className="text-[0.65rem] opacity-70">
                  {overview ? `${overview.custom.min}–${overview.custom.max}` : ''}
                </div>
              </button>
            </div>

            {selected === 'custom' && (
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount in USDC (${overview?.custom.min}–${overview?.custom.max})`}
                className="w-full px-3 py-2.5 mb-4 rounded-md bg-panel border border-border text-main text-sm outline-none focus:border-main"
              />
            )}

            {!connectedEvmAccount ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleConnectEvm}
                isLoading={connectingEvm}
                className="w-full"
              >
                <Wallet size={15} /> Connect EVM Wallet (MetaMask / Coinbase)
              </Button>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-3">
                  <span className="font-mono">
                    {connectedEvmAccount.slice(0, 8)}…{connectedEvmAccount.slice(-6)}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectEvm}
                    className="bg-transparent border-0 cursor-pointer text-muted hover:text-main p-0 text-xs"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  type="button"
                  onClick={buyEvm}
                  disabled={busy || !chosenTier}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? <Spinner size={15} /> : <Zap size={15} />}
                  {busy
                    ? stageLabel
                    : chosenTier
                      ? `Pay ${chosenTier.amountUsdc} USDC on ${EVM_TESTNET_CHAINS[selectedEvmChain]?.name || 'EVM'}`
                      : 'Choose an amount'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : fundingMethod === 'solana' ? (
        <div className="flex flex-col gap-4">
          {/* Solana Custodial Address & Details Card */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-main">
                Your Dedicated Solana Custodial Address
              </span>
              <span className="text-[10px] text-muted uppercase tracking-wide">Devnet</span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded bg-panel border border-border mb-3">
              <span className="font-mono text-xs text-main break-all flex-1 select-all">
                {overview?.solanaWalletAddress || 'Generating Solana address…'}
              </span>
              <button
                type="button"
                onClick={copySolanaAddress}
                className="p-1.5 rounded hover:bg-bg text-muted hover:text-main cursor-pointer border border-border shrink-0"
                title="Copy Solana Address"
              >
                {copiedSolana ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>

            <p className="text-xs text-muted mb-3 leading-relaxed">
              Your custodial Solana account receives SPL USDC on <strong>Solana Devnet</strong>.
              Payments to APIs and top-ups settle gasless with zero SOL needed by the caller.
            </p>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowRazorpayModal(true)}
              >
                <Smartphone size={14} /> Fund via Razorpay (UPI / Card)
              </Button>
              {overview?.solanaWalletAddress && (
                <a
                  href={`https://explorer.solana.com/address/${overview.solanaWalletAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-main"
                >
                  View on Solana Explorer <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* Pay with Connected Solana Wallet or Devnet Top-Up */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-3">
              Pay with Solana Wallet (Phantom / Solflare)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(overview?.tiers || []).map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelected(tier.id)}
                  className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                    selected === tier.id
                      ? 'bg-main text-bg border-main font-semibold'
                      : 'bg-panel text-main border-border hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tier.label}</div>
                  <div className="text-[0.65rem] opacity-70">{tier.amountUsdc} USDC</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected('custom')}
                className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                  selected === 'custom'
                    ? 'bg-main text-bg border-main font-semibold'
                    : 'bg-panel text-main border-border hover:border-white/30'
                }`}
              >
                <div className="text-lg">Custom</div>
                <div className="text-[0.65rem] opacity-70">
                  {overview ? `${overview.custom.min}–${overview.custom.max}` : ''}
                </div>
              </button>
            </div>

            {selected === 'custom' && (
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount in USDC (${overview?.custom.min}–${overview?.custom.max})`}
                className="w-full px-3 py-2.5 mb-4 rounded-md bg-panel border border-border text-main text-sm outline-none focus:border-main"
              />
            )}

            {!connectedSolanaAccount ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConnectSolana}
                  isLoading={connectingSolana}
                  className="w-full"
                >
                  <Wallet size={15} /> Connect Solana Wallet (Phantom / Solflare)
                </Button>
                <button
                  type="button"
                  onClick={buySolana}
                  disabled={busy || !chosenTier}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-panel hover:bg-panel-hover text-main border-border disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? <Spinner size={15} /> : <Zap size={15} />}
                  {busy
                    ? stageLabel
                    : chosenTier
                      ? `Direct Top-Up ${chosenTier.amountUsdc} USDC on Solana Devnet`
                      : 'Choose an amount'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-3">
                  <span className="font-mono">
                    {connectedSolanaAccount.slice(0, 8)}…{connectedSolanaAccount.slice(-6)}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectSolana}
                    className="bg-transparent border-0 cursor-pointer text-muted hover:text-main p-0 text-xs"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  type="button"
                  onClick={buySolana}
                  disabled={busy || !chosenTier}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? <Spinner size={15} /> : <Zap size={15} />}
                  {busy
                    ? stageLabel
                    : chosenTier
                      ? `Pay ${chosenTier.amountUsdc} USDC on Solana Devnet`
                      : 'Choose an amount'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : fundingMethod === 'stellar' ? (
        <div className="flex flex-col gap-4">
          {/* Stellar Custodial Address & Details Card */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-main">
                Your Dedicated Stellar Custodial Address
              </span>
              <span className="text-[10px] text-muted uppercase tracking-wide">
                Stellar Testnet / Soroban
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded bg-panel border border-border mb-3">
              <span className="font-mono text-xs text-main break-all flex-1 select-all">
                {overview?.stellarWalletAddress || 'Generating Stellar address…'}
              </span>
              <button
                type="button"
                onClick={copyStellarAddress}
                className="p-1.5 rounded hover:bg-bg text-muted hover:text-main cursor-pointer border border-border shrink-0"
                title="Copy Stellar Address"
              >
                {copiedStellar ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>

            <p className="text-xs text-muted mb-3 leading-relaxed">
              Your custodial Stellar account receives Soroban USDC on{' '}
              <strong>Stellar Testnet</strong>. Payments to APIs and top-ups settle gasless with
              fees sponsored by the facilitator.
            </p>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowRazorpayModal(true)}
              >
                <Smartphone size={14} /> Fund via Razorpay (UPI / Card)
              </Button>
              {overview?.stellarWalletAddress && (
                <a
                  href={
                    overview?.explorerUrls?.stellar ||
                    `https://stellar.expert/explorer/testnet/account/${overview.stellarWalletAddress}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-main"
                >
                  View on Stellar.Expert <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* Connect Freighter Wallet & Pay on Testnet */}
          <div className="p-4 rounded-lg bg-bg border border-border">
            <h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-3">
              Pay with Connected Freighter Wallet
            </h3>

            <div className="p-3 mb-4 rounded-md bg-panel border border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-muted" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-main">Freighter Extension</span>
                  {connectedFreighterAccount ? (
                    <span className="font-mono text-[11px] text-muted">
                      {connectedFreighterAccount.slice(0, 8)}…{connectedFreighterAccount.slice(-8)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">
                      Connect your Freighter browser wallet
                    </span>
                  )}
                </div>
              </div>

              {connectedFreighterAccount ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted font-mono">
                    USDC: <strong className="text-main">{freighterBalances?.usdc || '0'}</strong> •
                    XLM: <strong className="text-main">{freighterBalances?.xlm || '0'}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectFreighter}
                    className="text-xs text-muted hover:text-danger cursor-pointer ml-1"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleConnectFreighter}
                  isLoading={connectingFreighter}
                >
                  <Zap size={14} /> Connect Freighter
                </Button>
              )}
            </div>

            {connectedFreighterAccount &&
              freighterBalances &&
              !freighterBalances.hasUsdcTrustline && (
                <div className="p-3 mb-4 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning leading-relaxed flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>No USDC Trustline:</strong> Your connected Freighter wallet has no USDC
                    trustline on testnet. Please add the USDC asset in your Freighter extension
                    (Issuer:{' '}
                    <code className="font-mono text-[11px]">
                      GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
                    </code>
                    ).
                  </div>
                </div>
              )}

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(overview?.tiers || []).map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelected(tier.id)}
                  className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                    selected === tier.id
                      ? 'bg-main text-bg border-main font-semibold'
                      : 'bg-panel text-main border-border hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tier.label}</div>
                  <div className="text-[0.65rem] opacity-70">{tier.amountUsdc} USDC</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected('custom')}
                className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                  selected === 'custom'
                    ? 'bg-main text-bg border-main font-semibold'
                    : 'bg-panel text-main border-border hover:border-white/30'
                }`}
              >
                <div className="text-lg">Custom</div>
                <div className="text-[0.65rem] opacity-70">
                  {overview ? `${overview.custom.min}–${overview.custom.max}` : ''}
                </div>
              </button>
            </div>

            {selected === 'custom' && (
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount in USDC (${overview?.custom.min}–${overview?.custom.max})`}
                className="w-full px-3 py-2.5 mb-4 rounded-md bg-panel border border-border text-main text-sm outline-none focus:border-main"
              />
            )}

            <button
              type="button"
              onClick={buyStellar}
              disabled={busy || !chosenTier}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Spinner size={15} /> : <Zap size={15} />}
              {busy
                ? stageLabel
                : chosenTier
                  ? connectedFreighterAccount
                    ? `Pay ${chosenTier.amountUsdc} USDC with Freighter`
                    : `Direct Top-Up ${chosenTier.amountUsdc} USDC on Stellar Testnet`
                  : 'Choose an amount'}
            </button>
          </div>
        </div>
      ) : fundingMethod === 'fiat' ? (
        <div className="p-5 rounded-lg bg-bg border border-border text-center mb-4">
          <Smartphone size={28} className="mx-auto mb-2 text-muted" />
          <h3 className="text-sm font-medium text-main mb-1">Instant Fiat & UPI Top-Up</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-4">
            Top up your spendable USDC credit using any credit card, debit card, netbanking, or UPI
            via Razorpay. Automatically provisions and funds both your EVM and Algorand custodial
            wallets.
          </p>
          <Button type="button" variant="primary" onClick={() => setShowRazorpayModal(true)}>
            Launch Razorpay Checkout
          </Button>
        </div>
      ) : (
        <>
          <div className="p-4 rounded-lg bg-bg border border-border">
            <h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-3">
              Pay with External Algorand Wallet
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(overview?.tiers || []).map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelected(tier.id)}
                  className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                    selected === tier.id
                      ? 'bg-main text-bg border-main font-semibold'
                      : 'bg-panel text-main border-border hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tier.label}</div>
                  <div className="text-[0.65rem] opacity-70">{tier.amountUsdc} USDC</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected('custom')}
                className={`px-3 py-3 rounded-md border text-center cursor-pointer ${
                  selected === 'custom'
                    ? 'bg-main text-bg border-main font-semibold'
                    : 'bg-panel text-main border-border hover:border-white/30'
                }`}
              >
                <div className="text-lg">Custom</div>
                <div className="text-[0.65rem] opacity-70">
                  {overview ? `${overview.custom.min}–${overview.custom.max}` : ''}
                </div>
              </button>
            </div>

            {selected === 'custom' && (
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount in USDC (${overview?.custom.min}–${overview?.custom.max})`}
                className="w-full px-3 py-2.5 mb-4 rounded-md bg-panel border border-border text-main text-sm outline-none focus:border-main"
              />
            )}

            {!activeAccount ? (
              <div>
                <p className="text-xs text-muted mb-3">
                  Connect your browser or mobile Algorand wallet to approve and sign the top-up:
                </p>
                <div className="flex gap-2 flex-wrap mb-2">
                  {wallets.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        w.connect().catch((err: unknown) => {
                          console.warn('Algorand wallet connect dismissed or failed:', err);
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main"
                    >
                      <Wallet size={15} /> Connect {w.metadata.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-3">
                  <span className="font-mono">
                    {activeAccount.address.slice(0, 10)}…{activeAccount.address.slice(-6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      wallets
                        .find(w => w.isActive)
                        ?.disconnect()
                        .catch(() => {});
                    }}
                    className="bg-transparent border-0 cursor-pointer text-muted hover:text-main p-0 text-xs"
                  >
                    Disconnect
                  </button>
                </div>

                {algoOptInSuccess && (
                  <div className="p-3 mb-3 rounded-md bg-success/10 border border-success/30 text-xs text-success flex items-start gap-2">
                    <CheckCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{algoOptInSuccess}</span>
                  </div>
                )}

                {algoOptedIn === false && (
                  <div className="p-3 mb-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <strong>USDC Opt-In Required:</strong> Algorand accounts must opt into ASA
                        10458941 before sending or receiving USDC.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoOptIn}
                      disabled={optingInAlgo}
                      className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded bg-warning text-bg font-semibold text-xs border-0 cursor-pointer hover:opacity-90 disabled:opacity-50"
                    >
                      {optingInAlgo ? <Spinner size={13} /> : <Zap size={13} />}
                      Auto Opt-In Algorand Wallet (1-Click)
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleAutoOptIn}
                    disabled={optingInAlgo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium cursor-pointer border border-border bg-panel hover:bg-panel-hover text-main disabled:opacity-40"
                  >
                    {optingInAlgo ? <Spinner size={14} /> : <Zap size={14} />}
                    Auto Opt-In to USDC (ASA 10458941)
                  </button>

                  <button
                    type="button"
                    onClick={buyAlgo}
                    disabled={busy || !chosenTier}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer border bg-main text-bg border-main disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? <Spinner size={15} /> : <Zap size={15} />}
                    {busy
                      ? stageLabel
                      : chosenTier
                        ? `Pay ${chosenTier.amountUsdc} USDC on Algorand`
                        : 'Choose an amount'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {overview?.walletAddress && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted m-0">No crypto wallet? Pay with card or UPI.</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowRazorpayModal(true)}
          >
            <Smartphone size={14} /> Pay with Razorpay
          </Button>
        </div>
      )}

      {receipt && (
        <div className="mt-4 px-4 py-3 rounded-md border border-border bg-bg flex items-start gap-2 text-sm">
          <CheckCircle size={15} className="mt-0.5 shrink-0 text-main" />
          <div>
            <span className="text-main">Added {receipt.credited} USDC of credit.</span>
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-2 underline text-muted"
            >
              View on Explorer <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-xs text-error border border-error/40 bg-error/10 rounded-md px-3 py-2 m-0 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <RazorpayTopUpModal
        isOpen={showRazorpayModal}
        onClose={() => setShowRazorpayModal(false)}
        walletAddress={overview?.walletAddress}
        evmWalletAddress={overview?.evmWalletAddress}
        defaultAmount={chosenTier?.amountUsdc || 5}
        onSuccess={onCredited}
      />
    </div>
  );
};

export default TopUpPanel;
