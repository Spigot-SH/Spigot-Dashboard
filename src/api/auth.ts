import { BASE_URL } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  authProviders: string[];
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

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    // The session lives in an httpOnly cookie; it must ride along with every call.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }

  if (!res.ok) {
    const reported =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error?: unknown }).error
        : undefined;
    throw Object.assign(
      new Error(typeof reported === 'string' ? reported : `Request failed (${res.status})`),
      { status: res.status, body },
    );
  }
  return body as T;
};

export const authApi = {
  me: () => request<SessionState>('/auth/me'),

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
