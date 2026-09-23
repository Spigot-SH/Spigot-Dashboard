import { BASE_URL } from './client';

export interface PublishedEndpoint {
  id: string;
  name: string;
  method: string;
  path: string;
  description: string | null;
  example_request?: string | null;
  example_response?: string | null;
  auth_required?: boolean | number;
}

export interface PublishedApi {
  id: string;
  name: string;
  slug: string;
  publisherName: string;
  description: string;
  pricePerRequest: number | null;
  skills: string[];
  avgLatency: number | null;
  uptime: number | null;
  endpoints: PublishedEndpoint[];
}

export interface ApiQuote {
  pricePerRequest: number | null;
  currency: string;
  balance: number;
  canPay: boolean;
  callsAffordable: number;
}

export interface ConsumePaymentReceipt {
  txId: string;
  network?: string;
  amountUsdc: string;
  explorerUrl?: string;
  paidBy?: string;
}

export interface ConsumeResponse {
  ok: boolean;
  status: number;
  latencyMs: number;
  payment?: ConsumePaymentReceipt;
  response?: unknown;
  error?: string;
  details?: string;
  reason?: string;
  balance?: number;
}

export const catalogApi = {
  /** Fetch all published marketplace APIs with their endpoints and pricing. */
  async getPublishedApis(): Promise<PublishedApi[]> {
    const res = await fetch(`${BASE_URL}/apis`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Failed to load published APIs (${res.status})`);
    }
    return res.json();
  },

  /** Get live pricing and credit affordability quote for an API. */
  async getQuote(apiSlug: string): Promise<ApiQuote> {
    const res = await fetch(`${BASE_URL}/consume/${encodeURIComponent(apiSlug)}/quote`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Failed to load quote (${res.status})`);
    }
    return res.json();
  },

  /** Call a paid endpoint using user's USDC credit balance. */
  async consume(
    apiSlug: string,
    payload: {
      endpointId: string;
      query?: Record<string, string>;
      body?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<ConsumeResponse> {
    const res = await fetch(`${BASE_URL}/consume/${encodeURIComponent(apiSlug)}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.error) {
      throw new Error(data.message || `API consume failed with HTTP ${res.status}`);
    }
    return data as ConsumeResponse;
  },
};
