import { parseCheckResponse } from '../lib/domainVerification';

/**
 * Always the relative '/api', which next.config.ts rewrites to the Express backend.
 *
 * Same-origin is what lets the httpOnly session cookie work: the backend sets it SameSite=Lax,
 * so a cross-origin XHR would not send it. There is deliberately no override.
 */
export const BASE_URL = '/api';
// Publisher calls authenticate with the httpOnly session cookie only. The API key is for
// server-to-server use; the browser never stores or sends it. This name is kept only so
// clearAuth() can delete a key saved by an older build.
const API_KEY_STORAGE_KEY = 'x402_api_key';
const PUBLISHER_ID_STORAGE_KEY = 'x402_publisher_id';

export function setPublisherId(id: string): void {
  localStorage.setItem(PUBLISHER_ID_STORAGE_KEY, id);
}

export function getPublisherId(): string | null {
  return localStorage.getItem(PUBLISHER_ID_STORAGE_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(PUBLISHER_ID_STORAGE_KEY);
}

/**
 * Delete a key an older build left in localStorage, on load — not only at sign-out. A
 * browser that is already signed in when it upgrades to this build never fires sign-out, so
 * that alone left the key sitting there indefinitely. Safe to call before a session exists:
 * it only touches storage.
 */
export function clearLegacyApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage can throw (private mode, disabled storage) — nothing to clean up then.
  }
}

// --- Types ---
export interface Publisher {
  id?: string;
  name: string;
  description?: string;
  type: 'Company' | 'Individual';
  website: string;
  domain: string;
  email: string;
  logoUrl?: string;
  docsUrl?: string;
  githubUrl?: string;
  api_key?: string;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  name: string;
  description: string;
  requestSchema?: string;
  responseSchema?: string;
}

/** Upstream credentials. Which fields apply is decided by `authType`. */
export interface AuthConfig {
  header?: string;
  value?: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface RateLimitConfig {
  limit: number;
  /** Window in minutes. */
  window: number;
}

export interface ApiInfo {
  id?: string;
  slug?: string;
  publisherId: string;
  name: string;
  version: string;
  baseUrl: string;
  /**
   * The four schemes `services/proxy.ts` can actually attach to an upstream request, which
   * are the four `PUT /apis/:id/publish` accepts. Mirrors `OnboardingData.authType`.
   */
  authType: 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC';
  authConfig?: AuthConfig;
  rateLimitConfig?: RateLimitConfig;
  docsUrl?: string;
  endpoints?: ApiEndpoint[];
  skills?: string[];
  pricing?: {
    model: 'PayPerUse' | 'Subscription';
    pricePerRequest?: number;
    monthlyPrice?: number;
    includedRequests?: number;
    overagePrice?: number;
    settlementAddress: string;
    settlementFrequency: 'Daily' | 'Weekly' | 'Monthly';
    minPayout: number;
  };
}

/**
 * Dashboard table rows.
 *
 * Every field is optional and both spellings are carried, because the server sends SQL
 * aggregate names (`request_count`, `total_revenue`) while older payloads used the short
 * form. The view reads whichever is present rather than assuming one.
 */
export interface DashboardEndpointRow {
  path?: string;
  method?: string;
  requests?: number;
  request_count?: number;
  revenue?: number;
  total_revenue?: number;
  latency?: number;
  avg_latency?: number;
  api_name?: string;
  api_slug?: string;
  /** The owning API's publish status (`apis.status`). Backend commit b543472. */
  api_status?: string;
}

export interface DashboardTransactionRow {
  id?: string;
  tx_id?: string;
  amount?: number;
  status?: string;
  time?: string;
  created_at?: string;
}

export interface DashboardSettlementRow {
  id?: string;
  tx_id?: string;
  txHash?: string;
  amount?: number;
  status?: string;
  date?: string;
  created_at?: string;
  period_end?: string;
}

export interface DashboardHealth {
  avgLatency: number;
  /** null until the backend has run a health check. */
  status: string | null;
}

/** The normalised shape the dashboard view renders from. */
export interface DashboardStats {
  availableBalance: number;
  pendingBalance: number;
  settledBalance?: number;
  requestsToday: number;
  requestsMonth: number;
  /** null until there is at least one request. */
  successRate: number | null;
  endpoints: DashboardEndpointRow[];
  transactions: DashboardTransactionRow[];
  health: DashboardHealth;
  settlements: DashboardSettlementRow[];
}

/**
 * The raw `GET /dashboard/:id` body, before normalisation.
 *
 * The server spreads the balance record and sends snake_case totals; the camelCase keys are
 * kept so a payload from an older backend still maps instead of silently reading zero.
 */
export interface DashboardResponse {
  error?: string;
  publisherId?: string;
  publisherName?: string;
  available?: number;
  availableBalance?: number;
  pending?: number;
  pendingBalance?: number;
  requests_today?: number;
  requests_month?: number;
  success_rate?: number | null;
  successRate?: number;
  avg_latency?: number;
  health_status?: string | null;
  health?: DashboardHealth;
  endpoints?: DashboardEndpointRow[];
  transactions?: DashboardTransactionRow[];
  settlements?: DashboardSettlementRow[];
}

/** Body accepted by `POST /apis/:id/pricing`. */
export interface PricingPayload {
  model: 'PAY_PER_USE' | 'SUBSCRIPTION';
  price_per_request: number;
  currency: string;
  monthly_price?: number;
  included_requests?: number;
  overage_price?: number;
}

/** A health check row, as returned by `POST /apis/:id/test`. */
export interface HealthReport {
  id: string;
  api_id: string;
  dns_ok: boolean;
  https_ok: boolean;
  tls_expiry?: string;
  endpoint_ok: boolean;
  latency_ms: number;
  auth_ok: boolean;
  schema_ok: boolean;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  error_message?: string;
  created_at: string;
}

/**
 * Result of `POST /publishers/:id/wallet`.
 *
 * Setting a payout address for the first time saves it outright. Changing one already on the
 * account needs an emailed code first, which is what `saved: false` reports.
 */
export type WalletSaveResult =
  { saved: true; id: string; address: string } | { saved: false; message: string };

/**
 * Result of `POST /dashboard/:id/settle`.
 *
 * Only `PAID` returns 200 — every other status arrives as a non-ok response and is thrown,
 * so the payout fields are optional rather than a discriminated union.
 */
export interface SettleResult {
  status: 'PAID' | 'NOTHING_DUE' | 'NO_WALLET' | 'BELOW_MINIMUM' | 'FAILED';
  txId?: string;
  explorerUrl?: string;
  chain?: string;
  walletAddress?: string;
  settlement?: { amount?: number; [key: string]: unknown };
  message?: string;
  available?: number;
  minimum?: number;
}

// --- API Client ---
export const apiClient = {
  async registerPublisher(data: Partial<Publisher>): Promise<Publisher> {
    const res = await fetch(`${BASE_URL}/publishers`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    // The backend says why it refused (a domain already registered, an invalid email). A
    // fixed string here threw that away and the step showed "Please try again" for a
    // problem trying again cannot solve.
    if (!res.ok) {
      throw Object.assign(
        new Error(body?.error || body?.message || 'Failed to register publisher'),
        {
          body,
        },
      );
    }
    return body;
  },

  /**
   * Sends the emailed step-up code that `rotateApiKey` requires. A session cookie alone must
   * not be enough to mint or read a key, so issuing or rotating one is a two-step call: this
   * one, then `rotateApiKey` with the code it emails.
   */
  async requestApiKeyCode(): Promise<{ codeSent: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/publishers/api-key/request-code`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || 'Could not send a verification code');
    return {
      codeSent: Boolean(body?.codeSent),
      message:
        typeof body?.message === 'string' && body.message
          ? body.message
          : 'We emailed a verification code.',
    };
  },

  /**
   * New server-to-server API key, returned once, from the emailed step-up code
   * `requestApiKeyCode` sent. The previous key stops working immediately, including in any
   * other tab or device that had it. `signal` lets a caller give up waiting for a slow
   * response without leaving the request itself unresolved server-side — rotation is a single
   * atomic UPDATE, so a request that times out client-side may still have committed.
   */
  async rotateApiKey(
    publisherId: string,
    confirmationCode: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; api_key: string }> {
    const res = await fetch(`${BASE_URL}/publishers/${publisherId}/api-key`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationCode }),
      signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || 'Could not issue a new key');
    return body;
  },

  async initiateVerification(domain: string): Promise<{
    id: string;
    challenge: string;
    instructions: string;
    record: { type: string; name: string; value: string };
  }> {
    const res = await fetch(`${BASE_URL}/verify/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    if (!res.ok) throw new Error('Failed to initiate verification');
    return res.json();
  },

  async checkVerification(verificationId: string): Promise<{ status: string; error?: string }> {
    const res = await fetch(`${BASE_URL}/verify/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_id: verificationId }),
    });
    const body = await res.json().catch(() => ({}));
    // 410 is the backend's expiry response (verification.ts): the challenge is gone, not a
    // request failure, so it must reach the caller as a result, not a thrown error.
    if (!res.ok && res.status !== 410)
      throw new Error(body?.error || 'Failed to check verification');
    return parseCheckResponse(res.status, body);
  },

  async createApi(data: Partial<ApiInfo>): Promise<ApiInfo> {
    const res = await fetch(`${BASE_URL}/apis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(body?.error || body?.message || 'Failed to create API'), {
        body,
      });
    }
    return body;
  },

  async updateApiEndpoints(apiId: string, endpoints: ApiEndpoint[]): Promise<{ count: number }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoints }),
    });
    if (!res.ok) throw new Error('Failed to save endpoints');
    return res.json();
  },

  async importEndpoints(apiId: string, specOrUrl: string): Promise<{ endpoints: ApiEndpoint[] }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: specOrUrl }),
    });
    if (!res.ok) throw new Error('Failed to import OpenAPI spec');
    return res.json();
  },

  async setPricing(apiId: string, pricingData: PricingPayload): Promise<{ id: string }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/pricing`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pricingData),
    });
    if (!res.ok) throw new Error('Failed to set pricing');
    return res.json();
  },

  async testApi(apiId: string): Promise<HealthReport> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/test`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to run tests');
    return res.json();
  },

  async publishApi(apiId: string): Promise<{ url: string }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/publish`, {
      method: 'PUT',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to publish API');
    return res.json();
  },

  async getDashboard(publisherId: string): Promise<DashboardResponse> {
    const res = await fetch(`${BASE_URL}/dashboard/${publisherId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = Object.assign(
        new Error(body?.error || `Failed to fetch dashboard (${res.status})`),
        { status: res.status, body },
      );
      throw err;
    }
    return res.json();
  },

  /** The payout wallet row, or null when none is set. */
  async getWallet(publisherId: string): Promise<{ address?: string; chain?: string } | null> {
    const res = await fetch(`${BASE_URL}/publishers/${publisherId}/wallet`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Could not read the payout wallet (${res.status})`);
    return res.json();
  },

  async setWallet(
    publisherId: string,
    data: {
      address: string;
      chain?: string;
      settlement_frequency?: string;
      min_payout?: number;
      confirmationCode?: string;
    },
  ): Promise<WalletSaveResult> {
    const res = await fetch(`${BASE_URL}/publishers/${publisherId}/wallet`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(body?.error || body?.message || 'Failed to set wallet'), {
        body,
      });
    }
    // Changing an address that is already set answers 202 and emails a six-digit code; the
    // address is not stored until the same request comes back carrying it. 202 is `res.ok`,
    // so a caller that only checks `ok` tells the publisher their payout address moved when
    // it did not. Send the code back through `confirmationCode` to finish the change.
    if (body?.confirmationRequired) {
      return {
        saved: false,
        message:
          typeof body.message === 'string' && body.message
            ? body.message
            : 'We emailed a confirmation code. Enter it to move your payout address.',
      };
    }
    return { saved: true, id: body.id, address: body.address };
  },

  async settle(publisherId: string): Promise<SettleResult> {
    const res = await fetch(`${BASE_URL}/dashboard/${publisherId}/settle`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(body?.message || body?.error || 'Settlement failed'), {
        body,
      });
    }
    return body;
  },

  async addSkill(apiId: string, name: string): Promise<{ id: string }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to add skill');
    return res.json();
  },
};
