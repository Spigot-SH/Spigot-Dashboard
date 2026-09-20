import { request } from './request';

/** Know-the-user answers. Values mirror PROFILE_FIELDS in the backend's services/session.ts. */
export interface Profile {
  role?:
    | 'developer'
    | 'founder'
    | 'product'
    | 'marketing'
    | 'sales'
    | 'ops'
    | 'data'
    | 'finance'
    | 'student'
    | 'other';
  intent?: 'sell' | 'call' | 'both';
  volume?: 'under_10k' | '10k_to_1m' | 'over_1m';
  payout?: 'none' | 'wallet';
  skipped?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  authProviders: string[];
  /** Missing when the backend predates the profile column. */
  profile?: Profile;
}

export interface WalletInfo {
  address: string;
  optedIn: boolean;
  explorerUrl: string;
}

export interface Balances {
  address: string;
  algo: number;
  usdc: number;
  optedIn: boolean;
  exists: boolean;
}

export interface PublisherInfo {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  status: string;
  api_key?: string;
}

export interface SessionState {
  user: AuthUser | null;
  publisher?: PublisherInfo | null;
  credits: number;
  wallet: WalletInfo | null;
  evmWallet: WalletInfo | null;
  balances: Balances | null;
}

export interface PaymentReceipt {
  txId: string;
  network: string;
  amountUsdc: number;
  explorerUrl: string;
  paidBy: string;
  gasPaidByFacilitator: boolean;
}

export interface ConsumeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  response: unknown;
  payment: PaymentReceipt | null;
}

export interface Quote {
  pricePerRequest: number | null;
  currency: string;
  balance: number;
  canPay: boolean;
  callsAffordable: number;
}

export const authApi = {
  me: () => request<SessionState>('/auth/me'),

  updateProfile: (profile: Profile) =>
    request<{ user: AuthUser }>('/auth/me', { method: 'PATCH', body: JSON.stringify(profile) }),

  signInWithGoogle: (credential: string) =>
    request<{ user: AuthUser; isNew: boolean }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  requestMagicLink: (email: string) =>
    request<{ sent: boolean; channel: string; expiresInMinutes: number; devLink?: string }>(
      '/auth/magic-link',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    ),

  requestOtp: (email: string) =>
    request<{ sent: boolean; channel: string; expiresInMinutes: number; devCode?: string }>(
      '/auth/otp',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    ),

  verifyOtp: (email: string, code: string) =>
    request<{ user: AuthUser; isNew: boolean }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  activateWallet: () =>
    request<{ status: string; address: string; error?: string }>('/auth/wallet/activate', {
      method: 'POST',
    }),

  /** Omit amount to withdraw everything, which also closes the wallet and refunds its ALGO. */
  withdraw: (address: string, amount?: number) =>
    request<{
      txIds: string[];
      sentUsdc: number;
      feeUsdc: number;
      closed: boolean;
      destination: string;
      explorerUrls: string[];
    }>('/auth/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(amount === undefined ? { address } : { address, amount }),
    }),

  quote: (apiSlug: string) => request<Quote>(`/consume/${apiSlug}/quote`),

  /** Call a paid endpoint. The backend signs and settles — no wallet involved. */
  consume: (
    apiSlug: string,
    payload: { endpointId: string; query?: Record<string, string>; body?: unknown; chain?: string },
  ) =>
    request<ConsumeResult>(`/consume/${apiSlug}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
