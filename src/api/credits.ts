import { request } from './request';

export interface Tier {
  id: string;
  label: string;
  amountUsdc: number;
  taskRequired?: boolean;
  taskDescription?: string;
}

export interface TaskVerification {
  followedX: boolean;
  xHandleOrPost: string;
  linkedinUrl: string;
}

export interface CreditEntry {
  id: string;
  kind: 'RECHARGE' | 'SPEND' | 'REFUND' | 'ADJUST';
  amount: number;
  balance_after: number;
  source: string;
  description: string | null;
  created_at: string;
}

export interface ChainBalance {
  chain: string;
  name: string;
  family: 'algorand' | 'evm' | 'solana' | 'stellar';
  caip2: string;
  address: string;
  usdcBalance: number;
  nativeBalance: number;
  nativeSymbol: string;
  explorerUrl: string;
}

export interface CreditRequest {
  id: string;
  userId: string;
  amountUsdc: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface CreditsOverview {
  balance: number;
  currency: string;
  walletAddress?: string;
  /** Explorer links built by the backend so they follow the active network profile. */
  explorerUrls?: { algorand?: string; evm?: string; solana?: string; stellar?: string };
  evmWalletAddress?: string;
  solanaWalletAddress?: string;
  stellarWalletAddress?: string;
  chainBalances?: ChainBalance[];
  tiers: Tier[];
  custom: { min: number; max: number };
  history: CreditEntry[];
  testCreditClaimed?: boolean;
  pendingCreditRequest?: CreditRequest | null;
  latestCreditRequest?: CreditRequest | null;
}

export interface RechargeQuote {
  tier: Tier;
  requirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, unknown>;
  };
}

export interface RechargeResult {
  credited: number;
  balance: number;
  txId: string;
  explorerUrl: string;
}

export interface RazorpayOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Publishable checkout key. The secret never leaves the backend. */
  keyId: string;
  amountUsdc: number;
}

export interface RazorpayHandshake {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayResult {
  success: boolean;
  credited: number;
  balance?: number;
  txId?: string;
  walletAddress?: string;
  duplicate?: boolean;
}

export const creditsApi = {
  overview: () => request<CreditsOverview>('/credits'),

  quote: (tierId: string, amount?: number, chain?: string) =>
    request<RechargeQuote>('/credits/recharge/quote', {
      method: 'POST',
      body: JSON.stringify({
        tierId,
        ...(amount !== undefined ? { amount } : {}),
        ...(chain ? { chain } : {}),
      }),
    }),

  confirm: (tierId: string, paymentSignature: string, amount?: number) =>
    request<RechargeResult>('/credits/recharge', {
      method: 'POST',
      body: JSON.stringify(
        amount === undefined ? { tierId, paymentSignature } : { tierId, amount, paymentSignature },
      ),
    }),

  razorpayOrder: (amount: number) =>
    request<RazorpayOrder>('/credits/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  razorpayVerify: (handshake: RazorpayHandshake) =>
    request<RazorpayResult>('/credits/razorpay/verify-payment', {
      method: 'POST',
      body: JSON.stringify(handshake),
    }),

  treasuryTopUp: (
    tierId: string,
    amount?: number,
    chain?: string,
    verification?: TaskVerification,
  ) =>
    request<RechargeResult>('/credits/treasury-topup', {
      method: 'POST',
      body: JSON.stringify({
        tierId,
        ...(amount !== undefined ? { amount } : {}),
        ...(chain ? { chain } : {}),
        ...(verification ? { verification } : {}),
      }),
    }),

  unlockTutorial: () =>
    request<{ success: boolean; balance: number; unlocked?: boolean; alreadyUnlocked?: boolean }>(
      '/credits/unlock-tutorial',
      { method: 'POST' },
    ),

  applyPromo: (code: string) =>
    request<{
      success: boolean;
      code: string;
      credited: number;
      balance: number;
      message: string;
    }>('/credits/apply-promo', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  requestCredits: (data: { amount: number; reason?: string }) =>
    request<{ success: boolean; request: CreditRequest; message: string }>('/credits/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCreditRequests: () =>
    request<{ requests: CreditRequest[] }>('/credits/requests'),
};
