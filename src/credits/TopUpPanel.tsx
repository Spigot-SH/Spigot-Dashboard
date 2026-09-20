'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Gift,
  QrCode,
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
type Step = 'amount' | 'method' | 'crypto';
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

const NETWORKS: { key: WalletKind; name: string; logo: string }[] = [
  { key: 'algorand', name: 'Algorand', logo: LOGO('algorand') },
  { key: 'evm', name: 'Ethereum and L2s', logo: LOGO('ethereum') },
  { key: 'stellar', name: 'Stellar', logo: LOGO('stellar') },
];

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
    {marks && <span className="ml-2 flex shrink-0 items-center gap-1.5 self-center">{marks}</span>}
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
  const [selected, setSelected] = useState<string>('starter');
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

  useEffect(() => {
    if (overview?.tiers.length && !overview.tiers.some(t => t.id === selected)) {
      setSelected(overview.tiers[0].id);
    }
  }, [overview, selected]);

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
      finish(res.credited);
    } catch (err) {
      setError(apiErrorMessage(err, 'Test credit could not be added.'));
      setStage('idle');
    }
  }, [chosenTier, selected, finish]);

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
    if (overview?.tiers.length) setSelected(overview.tiers[0].id);
    setError(null);
    setReceipt(null);
    setStage('idle');
  };

  const title = receipt
    ? 'Credit added'
    : step === 'amount'
      ? 'How much credit?'
      : step === 'method'
        ? 'How would you like to pay?'
        : 'Pay from a wallet';

  return (
    <Modal isOpen={isOpen} onClose={close} title={title}>
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
          {step !== 'amount' && (
            <button
              type="button"
              onClick={() => setStep(step === 'crypto' ? 'method' : 'amount')}
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-muted hover:text-main"
            >
              <ArrowLeft size={13} />
              {step === 'crypto' ? 'Payment method' : 'Change amount'}
            </button>
          )}

          {step === 'amount' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(overview?.tiers || []).map(tier => (
                  <button
                    key={tier.id}
                    type="button"
                    aria-pressed={selected === tier.id}
                    onClick={() => setSelected(tier.id)}
                    className={`cursor-pointer rounded-md border px-3 py-4 text-center text-lg ${
                      selected === tier.id
                        ? 'border-main bg-main font-semibold text-bg'
                        : 'border-border bg-bg text-main hover:border-white/30'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => setStep('method')}
                disabled={!chosenTier}
                className="w-full"
              >
                {chosenTier ? `Continue with ${chosenTier.label}` : 'Choose an amount'}
              </Button>
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
                title="Card or UPI"
                hint="Through Razorpay. You are charged in rupees, and Razorpay shows the amount before you confirm."
                onClick={payByCard}
                disabled={busy}
                marks={<BrandLogo src={LOGO('razorpay')} size={18} />}
              />
              <Choice
                icon={<Wallet size={18} />}
                title="Crypto wallet"
                hint="A wallet you already hold, on Algorand, Ethereum and its L2s, or Stellar. Scan a code to use one on your phone."
                onClick={() => setStep('crypto')}
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
                    {NETWORKS.map(net => (
                      <BrandLogo key={net.key} src={net.logo} size={18} />
                    ))}
                  </>
                }
              />
              {isTestnetProfile && (
                <Choice
                  icon={<Gift size={18} />}
                  title="Test credit"
                  hint="Nobody is charged. It is funded by us and it works only on the test network."
                  onClick={addTestCredit}
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

          {step === 'crypto' && chosenTier && (
            <>
              <div>
                <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                  Network
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {NETWORKS.map(net => (
                    <button
                      key={net.key}
                      type="button"
                      aria-pressed={walletKind === net.key}
                      onClick={() => setWalletKind(net.key)}
                      className={`flex cursor-pointer flex-col items-center gap-2 whitespace-normal rounded-md border px-2 py-3 text-center text-xs ${
                        walletKind === net.key
                          ? 'border-main bg-panel-hover text-main'
                          : 'border-border bg-bg text-muted hover:border-white/30 hover:text-main'
                      }`}
                    >
                      <BrandLogo src={net.logo} />
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>

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
      <Button type="button" onClick={() => setOpen(true)}>
        Add credit
      </Button>

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
