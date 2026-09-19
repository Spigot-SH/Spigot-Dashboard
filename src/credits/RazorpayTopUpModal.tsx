'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { errorMessage } from '../lib/errors';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const AMOUNTS = [5, 10, 25, 50];

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  evmWalletAddress?: string;
  defaultAmount?: number;
  onSuccess: () => void;
}

export const RazorpayTopUpModal: React.FC<Props> = ({
  isOpen,
  onClose,
  walletAddress,
  evmWalletAddress,
  defaultAmount = 5,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Razorpay's checkout is a hosted script, so it can only be attached from the browser.
  // An effect keeps it out of the server render; the modal opening is what pulls it in.
  useEffect(() => {
    if (!isOpen) return;
    if (document.getElementById('razorpay-checkout-js')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = CHECKOUT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [isOpen]);

  const truncatedAlgo = walletAddress
    ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
    : '';
  const truncatedEvm = evmWalletAddress
    ? `${evmWalletAddress.slice(0, 8)}…${evmWalletAddress.slice(-6)}`
    : '';

  const launchCheckout = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // The backend opens the order and owns the amount. Everything the popup is told —
      // the key, the order id, the value in paise — comes back from that call.
      const order = await creditsApi.razorpayOrder(amount);

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout could not be loaded. Check your connection.');
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Spigot',
        description: `Top up ${order.amountUsdc} USDC of credit`,
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            setLoading(true);
            const result = await creditsApi.razorpayVerify({
              razorpayOrderId: response.razorpay_order_id || '',
              razorpayPaymentId: response.razorpay_payment_id || '',
              razorpaySignature: response.razorpay_signature || '',
            });
            setSuccessMsg(
              result.duplicate
                ? 'This payment was already credited.'
                : `Added ${result.credited} USDC to your balance.`,
            );
            onSuccess();
          } catch (verifyError) {
            setError(errorMessage(verifyError));
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });

      checkout.open();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  const inr = (amount * 87.5).toFixed(2);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Top up with Razorpay">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted m-0">
          UPI, cards and netbanking. The credit lands on the same balance your API calls spend from.
        </p>

        {(walletAddress || evmWalletAddress) && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
            {evmWalletAddress && (
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                  EVM Custodial (Base Sepolia / Sepolia)
                </span>
                <span className="font-mono text-xs text-main">{truncatedEvm}</span>
              </div>
            )}
            {walletAddress && (
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                  Algorand Custodial
                </span>
                <span className="font-mono text-xs text-main">{truncatedAlgo}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <span className="mb-2 block text-xs font-medium text-muted">Amount (USDC)</span>
          <div className="grid grid-cols-4 gap-2">
            {AMOUNTS.map(val => (
              <Button
                key={val}
                type="button"
                size="sm"
                variant={amount === val ? 'primary' : 'secondary'}
                onClick={() => setAmount(val)}
                aria-pressed={amount === val}
              >
                ${val}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-bg p-3.5">
          <div>
            <div className="text-xs text-muted">You pay</div>
            <div className="font-mono text-lg font-semibold text-main">₹{inr}</div>
          </div>
          <div className="text-right font-mono text-[0.65rem] text-muted">
            Indicative — the order is priced by the server
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error"
          >
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success"
          >
            <CheckCircle size={14} /> {successMsg}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={14} className="shrink-0" />
            Verified server-side
          </span>
          <Button type="button" onClick={launchCheckout} isLoading={loading}>
            {!loading && <ExternalLink size={15} />}
            {loading ? 'Opening…' : `Pay ₹${inr}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
