'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  QrCode,
  Send,
  Wallet,
} from 'lucide-react';
import { creditsApi, CreditsOverview, Tier } from '../api/credits';
import { apiErrorMessage, errorMessage } from '../lib/errors';
import {
  hasWalletConnect,
  isTestnetProfile,
  walletConnectProjectId,
} from '../wallet/walletManager';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Select } from '../components/common/Select';
import {
  connectInjectedEvmWallet,
  connectWalletConnectEvmWallet,
  disconnectEvmWallet,
  switchOrAddEvmChain,
  signExactEvmPayment,
  EVM_TESTNET_CHAINS,
} from '../wallet/evmWallet';

interface Props {
  overview: CreditsOverview | null;
  onCredited: () => void;
}

type Stage = 'idle' | 'quoting' | 'signing' | 'confirming';
type Step = 'amount' | 'method' | 'crypto' | 'social_tasks';
type WalletKind = 'algorand' | 'evm' | 'stellar';

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** What Razorpay's checkout handler hands back once the payer completes the flow. */
interface RazorpayHandlerResponse {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

interface RazorpayCheckout {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayCheckout;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Wrap a signed payload in the envelope the gateway expects.
 *
 * Every wallet produces a different proof; the envelope around it is identical, and writing it
 * out per wallet is how one of them ended up carrying a string nothing had signed.
 */
const encodePayment = (network: string, payload: unknown): string =>
  btoa(JSON.stringify({ x402Version: 2, scheme: 'exact', network, payload }));

/**
 * Brand marks live in `public/dashboard/logos/`, one SVG per name below.
 *
 * None of them are in the repo, and nothing in the dependency tree ships chain or payment
 * marks either. Hand-drawing an approximation of somebody's brand is worse than drawing
 * nothing, so `BrandLogo` renders nothing when the file is absent and the card falls back to
 * its words. Dropping a file in is the whole change; no code moves.
 *
 * Wallet marks are the exception and are not listed here: `@txnlab/use-wallet-pera` and
 * `@txnlab/use-wallet-walletconnect` ship their own as `w.metadata.icon`, so those are real
 * today and come straight off the adapter.
 */
const LOGO = (name: string) => `/dashboard/logos/${name}.svg`;

/**
 * The three networks offered first, then everything else behind a select.
 *
 * Solana is listed and disabled on purpose. The Solana path was deleted earlier because both
 * of its branches POSTed a string nothing had signed, and there is still no Solana signer
 * here: `@solana/web3.js` is not a dependency, so no transaction can be built, and the
 * backend requires `payload.transaction` for a Solana payment
 * (`Spigot-Algorand/backend/src/services/facilitator.ts:259`). Showing it greyed with the
 * reason is honest; showing it live would be a button that can only fail.
 */
const PRIMARY_NETWORKS: {
  key: WalletKind | 'solana';
  name: string;
  logo: string;
  disabledReason?: string;
}[] = [
  { key: 'algorand', name: 'Algorand', logo: LOGO('algorand') },
  {
    key: 'evm',
    name: 'Ethereum',
    logo: LOGO('ethereum'),
    disabledReason: 'Disabled — Spigot currently operates exclusively on Algorand.',
  },
  {
    key: 'solana',
    name: 'Solana',
    logo: LOGO('solana'),
    disabledReason: 'Disabled — Spigot currently operates exclusively on Algorand.',
  },
];

/** Everything that is not a headline network. Selecting one switches the wallet step to it. */
const OTHER_NETWORKS: { key: WalletKind; name: string }[] = [];

/** The mark if its file is there, nothing if it is not. Never a stand-in shape. */
const BrandLogo: React.FC<{ src: string; size?: number }> = ({ src, size = 22 }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      // A missing file is the expected state until the assets land, so it is handled rather
      // than logged: the card falls back to its words and the layout does not shift.
      onError={() => setMissing(true)}
      style={{ width: size, height: size }}
      className="object-contain"
      unoptimized
    />
  );
};

/**
 * A large pickable card. The method step is a short stack of these, so the choice is the screen.
 *
 * `whitespace-normal` is a deliberate opt-out from the rule at `src/styles/index.css:207`,
 * which sets `white-space: nowrap` on every `button` so that a control's label cannot wrap and
 * change the control's height. That rule is right for a label and wrong here: this button's
 * second line is body copy, and without the opt-out it ran 743px wide inside a 510px modal and
 * gave the dialog a horizontal scrollbar. The card's height is meant to follow its text.
 */
const Choice: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  /** Brand marks for what this choice actually uses. Absent when none are available. */
  marks?: React.ReactNode;
}> = ({ icon, title, hint, onClick, disabled, marks }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full cursor-pointer items-start gap-3 whitespace-normal rounded-lg border border-border bg-bg p-4 text-left hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
  >
    <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-main">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>
    </span>
    {/* Always rendered, even when empty. The marks used to be an optional sibling, so a row
        that had them gave its text less width than a row that did not and the titles stopped
        lining up down the list. A fixed column keeps every row identical. */}
    <span className="flex w-14 shrink-0 flex-wrap items-center justify-end gap-1.5 self-start pt-0.5">
      {marks}
    </span>
  </button>
);

const ConnectedRow: React.FC<{ address: string; onDisconnect: () => void }> = ({
  address,
  onDisconnect,
}) => (
  <div className="flex items-center justify-between gap-3 text-xs text-muted">
    <span className="font-mono">
      {address.slice(0, 8)}…{address.slice(-6)}
    </span>
    <button
      type="button"
      onClick={onDisconnect}
      className="cursor-pointer border-0 bg-transparent p-0 text-xs text-muted hover:text-main"
    >
      Disconnect
    </button>
  </div>
);

/**
 * Adding credit, as a modal in three steps: how much, how to pay, and for crypto, which wallet.
 *
 * Settling the amount first is what lets every payment path read one number. Each method used
 * to carry its own copy of the amount buttons, which is how the card modal came to offer
 * $5/$10/$25/$50 while the server's tiers were $5/$20/$50.
 *
 * Razorpay's checkout opens over this modal rather than inside a second one. It is a hosted
 * overlay of its own, and a modal within a modal has two Escape keys and one backdrop.
 *
 * The caller reads dollars throughout. The chain is named in one place, the wallet step,
 * because that is the only decision where it changes their answer.
 */
export const AddCreditModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  overview: CreditsOverview | null;
  onCredited: () => void;
}> = ({ isOpen, onClose, overview, onCredited }) => {
  const { activeAccount, signTransactions, wallets } = useWallet();

  const [step, setStep] = useState<Step>('amount');
  const [walletKind, setWalletKind] = useState<WalletKind>('algorand');
  // Empty until the caller picks. Nothing is chosen for them.
  const [selected, setSelected] = useState<string>('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ credited: number; explorerUrl?: string } | null>(null);

  const [evmChain, setEvmChain] = useState<string>('base');
  const [evmAccount, setEvmAccount] = useState<string | null>(null);
  const [connectingEvm, setConnectingEvm] = useState<'injected' | 'walletconnect' | null>(null);

  const [freighterAccount, setFreighterAccount] = useState<string | null>(null);
  const [freighterBalances, setFreighterBalances] = useState<{
    xlm: string;
    usdc: string;
    hasUsdcTrustline: boolean;
  } | null>(null);
  const [connectingFreighter, setConnectingFreighter] = useState(false);

  // Social tasks state for $20 test credit tier
  const [followedX, setFollowedX] = useState(false);
  const [xHandleOrPost, setXHandleOrPost] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Credit Request state (when test credits are blocked)
  const [requestAmount, setRequestAmount] = useState<'10' | '20'>('10');
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Razorpay's checkout is a hosted script, so it can only be attached from the browser. The
  // modal opening is what pulls it in; a visitor who never tops up never downloads it.
  const razorpayRequested = useRef(false);
  useEffect(() => {
    if (!isOpen || razorpayRequested.current) return;
    razorpayRequested.current = true;
    if (document.getElementById('razorpay-checkout-js')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = RAZORPAY_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [isOpen]);

  /**
   * The amount is always one of the server's tiers, never a number typed here.
   *
   * A custom field used to sit beside them, which meant the client had to re-check
   * `overview.custom.min`/`max` before every request and the modal opened on whatever had been
   * picked last. Three fixed amounts need neither. `overview.custom` is still served, and
   * nothing in this repo reads it now.
   */
  const chosenTier: Tier | undefined = useMemo(
    () => overview?.tiers.find(t => t.id === selected),
    [selected, overview?.tiers],
  );

  const busy = stage !== 'idle';
  const stageLabel = {
    quoting: 'Preparing payment…',
    signing: 'Approve in your wallet…',
    confirming: 'Adding the credit…',
  }[stage as 'quoting' | 'signing' | 'confirming'];

  const finish = useCallback(
    (credited: number, explorerUrl?: string) => {
      setReceipt({ credited, explorerUrl });
      setStage('idle');
      onCredited();
    },
    [onCredited],
  );

  const payByCard = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);
    setStage('confirming');

    try {
      // The backend opens the order and owns the amount. Everything the popup is told, the
      // key, the order id and the value in paise, comes back from that call. No rupee figure
      // is computed here: this flow used to print `amount * 87.5` as a quoted price.
      const order = await creditsApi.razorpayOrder(chosenTier.amountUsdc);
      if (!window.Razorpay) {
        throw new Error('Razorpay checkout could not be loaded. Check your connection.');
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Spigot',
        description: `$${order.amountUsdc} of credit`,
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const result = await creditsApi.razorpayVerify({
              razorpayOrderId: response.razorpay_order_id || '',
              razorpayPaymentId: response.razorpay_payment_id || '',
              razorpaySignature: response.razorpay_signature || '',
            });
            if (result.duplicate) {
              setError('This payment was already credited.');
              setStage('idle');
              return;
            }
            finish(result.credited);
          } catch (verifyError) {
            setError(errorMessage(verifyError));
            setStage('idle');
          }
        },
        modal: { ondismiss: () => setStage('idle') },
      });

      checkout.open();
    } catch (err) {
      setError(apiErrorMessage(err, 'The payment could not be started.'));
      setStage('idle');
    }
  }, [chosenTier, finish]);

  const addTestCredit = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);
    setStage('confirming');
    try {
      const res = await creditsApi.treasuryTopUp(selected);
      finish(res.credited, res.explorerUrl);
    } catch (err) {
      setError(apiErrorMessage(err, 'Test credit could not be added.'));
      setStage('idle');
    }
  }, [chosenTier, selected, finish]);

  const submitSocialTasks = useCallback(async () => {
    if (!chosenTier) return;
    if (!followedX || !xHandleOrPost.trim() || !linkedinUrl.trim()) {
      setError('Please complete all 3 tasks and provide your handles/links.');
      return;
    }
    setError(null);
    setStage('confirming');
    try {
      const res = await creditsApi.treasuryTopUp(selected, undefined, undefined, {
        followedX: true,
        xHandleOrPost: xHandleOrPost.trim(),
        linkedinUrl: linkedinUrl.trim(),
      });
      finish(res.credited, res.explorerUrl);
    } catch (err) {
      setError(apiErrorMessage(err, 'Task verification failed.'));
      setStage('idle');
    }
  }, [chosenTier, selected, followedX, xHandleOrPost, linkedinUrl, finish]);

  const handleApplyPromo = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = promoCode.trim();
      if (!trimmed) return;
      setPromoApplying(true);
      setPromoError(null);
      setPromoMessage(null);
      try {
        const res = await creditsApi.applyPromo(trimmed);
        setPromoMessage(
          res.message ||
            `Promo code ${res.code} applied! Added $${res.credited.toFixed(2)} to your balance.`,
        );
        setPromoCode('');
        onCredited();
      } catch (err) {
        setPromoError(apiErrorMessage(err, 'Failed to apply promo code.'));
      } finally {
        setPromoApplying(false);
      }
    },
    [promoCode, onCredited],
  );

  const handleRequestCredits = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const num = parseFloat(requestAmount);
      if (num !== 10 && num !== 20) {
        setRequestError('Only $10 or $20 credits can be requested.');
        return;
      }
      setRequestError(null);
      setRequestMessage(null);
      setRequestSubmitting(true);
      try {
        const res = await creditsApi.requestCredits({
          amount: num,
          reason: requestReason.trim() || undefined,
        });
        setRequestMessage(res.message);
        setRequestReason('');
        onCredited();
      } catch (err) {
        setRequestError(apiErrorMessage(err, 'Failed to submit credit request.'));
      } finally {
        setRequestSubmitting(false);
      }
    },
    [requestAmount, requestReason, onCredited],
  );

  const connectEvm = async (how: 'injected' | 'walletconnect') => {
    setError(null);
    setConnectingEvm(how);
    try {
      setEvmAccount(
        how === 'injected'
          ? await connectInjectedEvmWallet()
          : await connectWalletConnectEvmWallet(walletConnectProjectId),
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'That wallet could not be connected.'));
    } finally {
      setConnectingEvm(null);
    }
  };

  const connectFreighter = async () => {
    setError(null);
    setConnectingFreighter(true);
    try {
      const { connectFreighterWallet, getFreighterBalances } =
        await import('../wallet/freighterWallet');
      const address = await connectFreighterWallet();
      setFreighterAccount(address);
      setFreighterBalances(await getFreighterBalances(address));
    } catch (err) {
      setError(apiErrorMessage(err, 'Freighter could not be connected.'));
    } finally {
      setConnectingFreighter(false);
    }
  };

  /**
   * One payment path with three signers.
   *
   * The quote, the envelope, the confirm call and the failure handling are the same whichever
   * wallet signs, so they live here once. Only the signature itself is per wallet.
   */
  const payWithWallet = useCallback(async () => {
    if (!chosenTier) return;
    setError(null);

    try {
      setStage('quoting');
      let paymentSignature: string;
      let walletExplorerUrl: string | undefined;

      if (walletKind === 'algorand') {
        if (!activeAccount) throw new Error('Connect an Algorand wallet first.');
        const quote = await creditsApi.quote(selected);

        setStage('signing');
        const { ExactAvmScheme } = await import('@x402/avm/exact/client');
        const scheme = new ExactAvmScheme({
          address: activeAccount.address,
          signTransactions: (txns: Uint8Array[], indexes?: number[]) =>
            signTransactions(txns, indexes) as Promise<(Uint8Array | null)[]>,
        });
        const signed = await scheme.createPaymentPayload(2, quote.requirements as never);
        paymentSignature = encodePayment(quote.requirements.network, signed.payload);
      } else if (walletKind === 'evm') {
        if (!evmAccount) throw new Error('Connect a wallet first.');
        const chain = EVM_TESTNET_CHAINS[evmChain];
        await switchOrAddEvmChain(chain);
        const quote = await creditsApi.quote(selected, undefined, chain.key);

        setStage('signing');
        paymentSignature = await signExactEvmPayment(quote.requirements, evmAccount);
      } else {
        if (!freighterAccount) throw new Error('Connect Freighter first.');
        const quote = await creditsApi.quote(selected, undefined, 'stellar');

        setStage('signing');
        const { payUsdcWithFreighter, getFreighterBalances } =
          await import('../wallet/freighterWallet');
        const paid = await payUsdcWithFreighter({
          payerAddress: freighterAccount,
          recipientAddress: quote.requirements.payTo,
          amountUsdc: chosenTier.amountUsdc,
          isMainnet: !isTestnetProfile,
        });
        paymentSignature = encodePayment(quote.requirements.network, {
          account: freighterAccount,
          payer: freighterAccount,
          transaction: paid.signedTxXdr,
          txHash: paid.txHash,
        });
        walletExplorerUrl = `https://stellar.expert/explorer/testnet/tx/${paid.txHash}`;
        getFreighterBalances(freighterAccount)
          .then(setFreighterBalances)
          .catch(() => null);
      }

      setStage('confirming');
      const confirmed = await creditsApi.confirm(selected, paymentSignature);
      finish(confirmed.credited, confirmed.explorerUrl || walletExplorerUrl);
    } catch (err) {
      setError(apiErrorMessage(err, 'The payment did not go through.'));
      setStage('idle');
    }
  }, [
    chosenTier,
    walletKind,
    selected,
    activeAccount,
    signTransactions,
    evmAccount,
    evmChain,
    freighterAccount,
    finish,
  ]);

  const walletConnected =
    walletKind === 'algorand'
      ? Boolean(activeAccount)
      : walletKind === 'evm'
        ? Boolean(evmAccount)
        : Boolean(freighterAccount);

  const close = () => {
    onClose();
    // Reset on the way out, so reopening is a fresh top-up rather than the last receipt,
    // and lands on the first tier rather than whatever was picked last time.
    setStep('amount');
    setSelected('');
    setError(null);
    setReceipt(null);
    setStage('idle');
    setFollowedX(false);
    setXHandleOrPost('');
    setLinkedinUrl('');
    setPromoCode('');
    setPromoApplying(false);
    setPromoMessage(null);
    setPromoError(null);
  };

  const title = receipt
    ? 'Credit added'
    : step === 'amount'
      ? 'How much credit?'
      : step === 'method'
        ? 'How would you like to pay?'
        : step === 'social_tasks'
          ? 'Complete tasks for $20 credit'
          : 'Pay from a wallet';

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={title}
      onBack={
        receipt || step === 'amount'
          ? undefined
          : () => {
              // Without this a failure from the step being left, "Razorpay is not
              // configured" for instance, stays on screen under the next step's controls.
              setError(null);
              setStep(step === 'crypto' || step === 'social_tasks' ? 'method' : 'amount');
            }
      }
      backLabel={step === 'crypto' || step === 'social_tasks' ? 'Payment method' : 'Change amount'}
    >
      {receipt ? (
        <div className="flex flex-col gap-4">
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-border bg-bg px-4 py-3 text-sm"
          >
            <CheckCircle size={15} className="mt-0.5 shrink-0 text-main" />
            <div>
              <span className="text-main">
                Added ${receipt.credited.toFixed(2)} to your balance.
              </span>
              {receipt.explorerUrl && (
                <a
                  href={receipt.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-muted underline"
                >
                  View the transaction <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
          <Button type="button" onClick={close} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {step === 'amount' && (
            <>
              {overview?.testCreditClaimed ? (
                <div className="space-y-4">
                  {/* Blocked alert banner */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <Clock size={16} className="mt-0.5 shrink-0 text-amber-400" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-main">
                          Test Credits Claimed
                        </p>
                        <p className="text-[11px] leading-relaxed text-muted">
                          You have already received test credits ($10 / $20) on this account. Direct test credit claims are now blocked. You can submit a credit request below for administrator approval.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Pending Request status */}
                  {overview.pendingCreditRequest ? (
                    <div className="rounded-lg border border-border bg-panel p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                          Credit Request Status
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                          <Clock size={11} /> Pending Review
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-2xl font-bold font-mono text-main">
                          ${overview.pendingCreditRequest.amountUsdc.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted">
                          Submitted {new Date(overview.pendingCreditRequest.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {overview.pendingCreditRequest.reason && (
                        <p className="text-xs text-muted italic m-0">
                          &ldquo;{overview.pendingCreditRequest.reason}&rdquo;
                        </p>
                      )}
                      <p className="text-[11px] text-muted/70 m-0">
                        Your request is currently in the administrator queue. Once approved, credits will be added to your balance automatically.
                      </p>
                    </div>
                  ) : (
                    /* Request more credits form */
                    <div className="rounded-lg border border-border bg-panel p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-main">
                          <Send size={13} className="text-accent" />
                          <span>Request Credits</span>
                        </div>
                        <span className="text-[11px] text-muted">Admin Approval</span>
                      </div>

                      {overview.latestCreditRequest?.status === 'rejected' && (
                        <div className="rounded border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                          Previous request was rejected: {overview.latestCreditRequest.adminNote || 'No reason provided'}. You may submit a new request.
                        </div>
                      )}

                      <form onSubmit={handleRequestCredits} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5">
                            Select Amount ($ USDC)
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {(['10', '20'] as const).map(amt => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => {
                                  setRequestAmount(amt);
                                  setRequestError(null);
                                }}
                                className={`rounded-lg border p-3 text-center transition-all cursor-pointer ${
                                  requestAmount === amt
                                    ? 'border-main bg-main text-bg shadow-sm'
                                    : 'border-border bg-bg text-main hover:border-white/30 hover:bg-panel-hover'
                                }`}
                              >
                                <div className="text-lg font-bold font-mono">${amt}</div>
                                <div
                                  className={`text-[11px] mt-0.5 ${
                                    requestAmount === amt ? 'text-bg/85' : 'text-muted'
                                  }`}
                                >
                                  {amt === '10' ? '$10 Test Credit' : '$20 Test Credit'}
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="mt-1.5 text-[11px] text-muted">
                            Only $10 or $20 credits can be requested.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5">
                            Purpose / Usage Intent (Optional)
                          </label>
                          <input
                            type="text"
                            value={requestReason}
                            onChange={e => setRequestReason(e.target.value)}
                            placeholder="e.g. Testing Claude MCP server integration"
                            className="w-full rounded border border-border bg-bg px-3 py-1.5 text-xs text-main placeholder:text-muted/60 outline-none focus:border-main"
                          />
                        </div>

                        {requestError && (
                          <p className="m-0 flex items-center gap-1.5 text-xs text-error">
                            <AlertCircle size={13} className="text-error" /> {requestError}
                          </p>
                        )}
                        {requestMessage && (
                          <p className="m-0 flex items-center gap-1.5 text-xs text-main">
                            <CheckCircle size={13} className="text-main" /> {requestMessage}
                          </p>
                        )}

                        <Button
                          type="submit"
                          variant="primary"
                          className="w-full"
                          isLoading={requestSubmitting}
                          disabled={requestSubmitting || (requestAmount !== '10' && requestAmount !== '20')}
                        >
                          Submit Credit Request (${requestAmount})
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Promo code redemption card */}
                  <div className="rounded-lg border border-border bg-bg p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-main">
                        <Gift size={13} className="text-muted" />
                        <span>Have a promo code?</span>
                      </div>
                      <span className="text-[11px] text-muted">Get extra credits</span>
                    </div>
                    <form onSubmit={handleApplyPromo} className="mt-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={e => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError(null);
                          setPromoMessage(null);
                        }}
                        disabled={promoApplying}
                        className="flex-1 rounded border border-border bg-panel px-3 py-1.5 text-xs uppercase text-main placeholder:normal-case placeholder:text-muted/60 focus:border-main focus:outline-none"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={!promoCode.trim() || promoApplying}
                        isLoading={promoApplying}
                      >
                        Apply
                      </Button>
                    </form>
                    {promoMessage && (
                      <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-main">
                        <CheckCircle size={13} className="text-main" /> {promoMessage}
                      </p>
                    )}
                    {promoError && (
                      <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-error">
                        <AlertCircle size={13} className="text-error" /> {promoError}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {(overview?.tiers || []).map(tier => (
                      <button
                        key={tier.id}
                        type="button"
                        aria-pressed={selected === tier.id}
                        onClick={() => setSelected(tier.id)}
                        className={`cursor-pointer rounded-lg border p-4 text-center transition-all ${
                          selected === tier.id
                            ? 'border-main bg-main text-bg'
                            : 'border-border bg-bg text-main hover:border-white/30 hover:bg-panel-hover'
                        }`}
                      >
                        <div className="text-xl font-bold">{tier.label}</div>
                        {tier.taskRequired ? (
                          <div
                            className={`mt-1.5 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                              selected === tier.id ? 'bg-bg/20 text-bg' : 'bg-accent/15 text-accent'
                            }`}
                          >
                            Social tasks
                          </div>
                        ) : (
                          <div
                            className={`mt-1.5 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                              selected === tier.id ? 'bg-bg/20 text-bg' : 'bg-white/10 text-muted'
                            }`}
                          >
                            Instant
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Promo code redemption card */}
                  <div className="rounded-lg border border-border bg-bg p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-main">
                        <Gift size={13} className="text-muted" />
                        <span>Have a promo code?</span>
                      </div>
                      <span className="text-[11px] text-muted">Get extra credits</span>
                    </div>
                    <form onSubmit={handleApplyPromo} className="mt-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={e => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError(null);
                          setPromoMessage(null);
                        }}
                        disabled={promoApplying}
                        className="flex-1 rounded border border-border bg-panel px-3 py-1.5 text-xs uppercase text-main placeholder:normal-case placeholder:text-muted/60 focus:border-main focus:outline-none"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={!promoCode.trim() || promoApplying}
                        isLoading={promoApplying}
                      >
                        Apply
                      </Button>
                    </form>
                    {promoMessage && (
                      <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-main">
                        <CheckCircle size={13} className="text-main" /> {promoMessage}
                      </p>
                    )}
                    {promoError && (
                      <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-error">
                        <AlertCircle size={13} className="text-error" /> {promoError}
                      </p>
                    )}
                  </div>

                  {/* Secondary until an amount is picked */}
                  <Button
                    type="button"
                    variant={chosenTier ? 'primary' : 'secondary'}
                    onClick={() => setStep('method')}
                    disabled={!chosenTier}
                    className="w-full"
                  >
                    Continue
                  </Button>
                </>
              )}
            </>
          )}

          {step === 'method' && chosenTier && (
            <>
              <div className="flex items-center justify-between rounded-md border border-border bg-bg px-3.5 py-2.5">
                <span className="text-sm text-muted">Adding</span>
                <span className="font-mono text-lg font-semibold text-main">
                  {chosenTier.label}
                </span>
              </div>
              <Choice
                icon={<CreditCard size={18} />}
                title="Card, UPI or netbanking"
                hint="The exact amount and currency are shown by the payment page before you confirm."
                onClick={payByCard}
                disabled={busy}
              />
              <Choice
                icon={<Wallet size={18} />}
                title="Crypto wallet"
                hint="A wallet you already hold on Algorand. Scan a code to use Pera or Defly on your phone."
                onClick={() => {
                  setError(null);
                  setStep('crypto');
                }}
                disabled={busy}
                marks={
                  <>
                    {/* Real artwork, shipped by the adapters themselves. The network marks
                        beside them appear as soon as their files exist. */}
                    {wallets.slice(0, 2).map(w => (
                      <Image
                        key={w.id}
                        src={w.metadata.icon}
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={18}
                        unoptimized
                        className="h-[18px] w-[18px] rounded-sm object-contain"
                      />
                    ))}
                    {PRIMARY_NETWORKS.filter(n => !n.disabledReason).map(net => (
                      <BrandLogo key={net.key} src={net.logo} size={18} />
                    ))}
                  </>
                }
              />
              {isTestnetProfile && !overview?.testCreditClaimed && (
                <Choice
                  icon={<Gift size={18} />}
                  title="Test credit"
                  hint={
                    chosenTier.taskRequired || chosenTier.amountUsdc === 20
                      ? 'Complete verifiable tasks on X and LinkedIn to claim $20 test credit.'
                      : 'Nobody is charged. It is funded by us and it works only on the test network.'
                  }
                  onClick={() => {
                    setError(null);
                    if (chosenTier.taskRequired || chosenTier.amountUsdc === 20) {
                      setStep('social_tasks');
                    } else {
                      addTestCredit();
                    }
                  }}
                  disabled={busy}
                />
              )}
              {busy && (
                <p className="m-0 text-center text-xs text-muted" role="status">
                  {stageLabel}
                </p>
              )}
            </>
          )}

          {step === 'social_tasks' && chosenTier && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-md border border-border bg-bg px-3.5 py-2.5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Verifiable Tasks
                  </span>
                  <div className="text-xs text-main">
                    Complete all 3 tasks to unlock your $20 test credit
                  </div>
                </div>
                <span className="font-mono text-lg font-semibold text-main">
                  {chosenTier.label}
                </span>
              </div>

              {/* Task 1: Follow @spigot_sh on X */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-panel text-[11px] font-bold text-main">
                      1
                    </span>
                    <span className="text-sm font-medium text-main">Follow @spigot_sh on X</span>
                  </div>
                  <a
                    href="https://x.com/intent/follow?screen_name=spigot_sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-panel px-2.5 py-1 text-xs font-medium text-main hover:border-white/30 hover:bg-panel-hover"
                  >
                    Follow on X <ExternalLink size={11} />
                  </a>
                </div>
                <p className="m-0 pl-7 text-xs text-muted">
                  Follow our official account on X for updates and releases.
                </p>
                <div className="pl-7 pt-0.5">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-main">
                    <input
                      type="checkbox"
                      checked={followedX}
                      onChange={e => setFollowedX(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-main"
                    />
                    <span>I have followed @spigot_sh</span>
                  </label>
                </div>
              </div>

              {/* Task 2: Post an intent about Spigot on X */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-panel text-[11px] font-bold text-main">
                      2
                    </span>
                    <span className="text-sm font-medium text-main">Post an intent on X</span>
                  </div>
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                      'Building with @spigot_sh — metered API gateways and instant MCP connectivity for AI agents! 🚀\n\nhttps://spigot.sh',
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-panel px-2.5 py-1 text-xs font-medium text-main hover:border-white/30 hover:bg-panel-hover"
                  >
                    Post on X <ExternalLink size={11} />
                  </a>
                </div>
                <p className="m-0 pl-7 text-xs text-muted">
                  Post about what you are building with Spigot on X.
                </p>
                <div className="pl-7">
                  <input
                    type="text"
                    placeholder="Your X handle or post URL (e.g. @yourhandle)"
                    value={xHandleOrPost}
                    onChange={e => setXHandleOrPost(e.target.value)}
                    className="w-full rounded border border-border bg-panel px-3 py-1.5 text-xs text-main placeholder:text-muted/60 focus:border-main focus:outline-none"
                  />
                </div>
              </div>

              {/* Task 3: Share an intent on LinkedIn */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-panel text-[11px] font-bold text-main">
                      3
                    </span>
                    <span className="text-sm font-medium text-main">
                      Share an intent on LinkedIn
                    </span>
                  </div>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      'https://spigot.sh',
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-panel px-2.5 py-1 text-xs font-medium text-main hover:border-white/30 hover:bg-panel-hover"
                  >
                    Share on LinkedIn <ExternalLink size={11} />
                  </a>
                </div>
                <p className="m-0 pl-7 text-xs text-muted">
                  Share Spigot with your professional network on LinkedIn.
                </p>
                <div className="pl-7">
                  <input
                    type="text"
                    placeholder="Your LinkedIn profile or post URL (e.g. linkedin.com/in/...)"
                    value={linkedinUrl}
                    onChange={e => setLinkedinUrl(e.target.value)}
                    className="w-full rounded border border-border bg-panel px-3 py-1.5 text-xs text-main placeholder:text-muted/60 focus:border-main focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={submitSocialTasks}
                disabled={
                  !followedX ||
                  xHandleOrPost.trim().length < 2 ||
                  linkedinUrl.trim().length < 5 ||
                  busy
                }
                isLoading={busy}
                className="w-full mt-1"
              >
                {busy ? stageLabel : 'Verify Tasks & Claim $20 Credit'}
              </Button>
            </div>
          )}

          {step === 'crypto' && chosenTier && (
            <>
              <div>
                <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                  Network
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMARY_NETWORKS.map(net => {
                    const on = walletKind === net.key;
                    return (
                      <button
                        key={net.key}
                        type="button"
                        aria-pressed={on}
                        disabled={Boolean(net.disabledReason)}
                        title={net.disabledReason}
                        onClick={() => setWalletKind(net.key as WalletKind)}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 whitespace-normal rounded-lg border px-2 py-4 text-center text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                          on
                            ? 'border-main bg-panel-hover font-medium text-main'
                            : 'border-border bg-bg text-muted hover:border-white/30 hover:text-main'
                        }`}
                      >
                        <BrandLogo src={net.logo} />
                        {net.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* The long tail. A network the caller rarely picks does not deserve a tile. */}
              {OTHER_NETWORKS.length > 0 && (
                <Select
                  label="Other networks"
                  value={OTHER_NETWORKS.some(n => n.key === walletKind) ? walletKind : ''}
                  onChange={e => e.target.value && setWalletKind(e.target.value as WalletKind)}
                >
                  <option value="">Choose a network</option>
                  {OTHER_NETWORKS.map(n => (
                    <option key={n.key} value={n.key}>
                      {n.name}
                    </option>
                  ))}
                </Select>
              )}

              {walletKind === 'evm' && (
                <Select label="Chain" value={evmChain} onChange={e => setEvmChain(e.target.value)}>
                  {Object.values(EVM_TESTNET_CHAINS).map(chain => (
                    <option key={chain.key} value={chain.key}>
                      {chain.name}
                    </option>
                  ))}
                </Select>
              )}

              {walletKind === 'algorand' &&
                (activeAccount ? (
                  <ConnectedRow
                    address={activeAccount.address}
                    onDisconnect={() =>
                      wallets
                        .find(w => w.isActive)
                        ?.disconnect()
                        .catch(() => null)
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {wallets.map(w => (
                      <Button
                        key={w.id}
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          w.connect().catch((err: unknown) => {
                            console.warn('Algorand wallet connect dismissed or failed:', err);
                          })
                        }
                      >
                        {/* The adapters ship their own mark, so this is the real Pera and
                            WalletConnect artwork rather than a generic glyph. */}
                        <Image
                          src={w.metadata.icon}
                          alt=""
                          aria-hidden="true"
                          width={16}
                          height={16}
                          unoptimized
                          className="mr-2 h-4 w-4 rounded-sm object-contain"
                        />
                        {w.metadata.name}
                      </Button>
                    ))}
                  </div>
                ))}

              {walletKind === 'evm' &&
                (evmAccount ? (
                  <ConnectedRow
                    address={evmAccount}
                    onDisconnect={() => {
                      setEvmAccount(null);
                      void disconnectEvmWallet();
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => connectEvm('injected')}
                      isLoading={connectingEvm === 'injected'}
                    >
                      <Wallet size={15} className="mr-2" /> Browser wallet
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => connectEvm('walletconnect')}
                      isLoading={connectingEvm === 'walletconnect'}
                      disabled={!hasWalletConnect}
                      title={
                        hasWalletConnect
                          ? 'Scan a code with a wallet on your phone'
                          : 'WalletConnect is not configured for this deployment'
                      }
                    >
                      <QrCode size={15} className="mr-2" /> WalletConnect
                    </Button>
                  </div>
                ))}

              {walletKind === 'stellar' &&
                (freighterAccount ? (
                  <ConnectedRow
                    address={freighterAccount}
                    onDisconnect={() => {
                      setFreighterAccount(null);
                      setFreighterBalances(null);
                    }}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={connectFreighter}
                    isLoading={connectingFreighter}
                  >
                    <Wallet size={15} className="mr-2" /> Connect Freighter
                  </Button>
                ))}

              {walletKind === 'stellar' &&
                freighterBalances &&
                !freighterBalances.hasUsdcTrustline && (
                  <p className="m-0 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    This Freighter account holds no USDC trustline, so it cannot send the payment.
                    Add the USDC asset in Freighter first.
                  </p>
                )}

              <Button
                type="button"
                onClick={payWithWallet}
                disabled={!walletConnected}
                isLoading={busy}
                className="w-full"
              >
                {busy
                  ? stageLabel
                  : walletConnected
                    ? `Pay ${chosenTier.label}`
                    : 'Connect a wallet to pay'}
              </Button>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="m-0 flex items-start gap-2 rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

/** The card on `/profile` that opens the flow. Everything else happens in the modal. */
const TopUpPanel: React.FC<Props> = ({ overview, onCredited }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-panel p-5">
      <div className="min-w-0">
        <h2 className="m-0 text-base text-main">Add credit</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Credit you add here is what your API calls spend.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Gift size={14} className="mr-1.5" /> Promo code
        </Button>
        <Button type="button" onClick={() => setOpen(true)}>
          Add credit
        </Button>
      </div>

      <AddCreditModal
        isOpen={open}
        onClose={() => setOpen(false)}
        overview={overview}
        onCredited={onCredited}
      />
    </div>
  );
};

export default TopUpPanel;
