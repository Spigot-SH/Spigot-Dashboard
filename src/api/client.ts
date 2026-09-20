/**
 * Always the relative '/api', which next.config.ts rewrites to the Express backend.
 *
 * Same-origin is what lets the httpOnly session cookie work: the backend sets it SameSite=Lax,
 * so a cross-origin XHR would not send it. There is deliberately no override.
 */
export const BASE_URL = '/api';
const API_KEY_STORAGE_KEY = 'x402_api_key';
const PUBLISHER_ID_STORAGE_KEY = 'x402_publisher_id';

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

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

function authHeaders(): Record<string, string> {
  const key = getApiKey();
  return key ? { 'X-API-Key': key } : {};
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
   * Both spellings are accepted. `'None'` is the legacy value the onboarding select still
   * emits; the backend uppercases before validating, so it keeps working. Mirrors
   * `OnboardingData.authType`.
   */
  authType: 'NONE' | 'None' | 'API_KEY' | 'BEARER' | 'OAUTH' | 'BASIC' | 'CUSTOM';
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

export interface MarketplaceApi {
  id: string;
  name: string;
  slug: string;
  publisherName: string;
  description: string;
  pricePerRequest: number;
  /** null until the API has had a health check. Never a default. */
  avgLatency: number | null;
  uptime: number | null;
  skills: string[];
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
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to register publisher');
    return res.json();
  },

  async initiateVerification(
    domain: string,
  ): Promise<{ id: string; challenge: string; instructions: string }> {
    const res = await fetch(`${BASE_URL}/verify/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ domain }),
    });
    if (!res.ok) throw new Error('Failed to initiate verification');
    return res.json();
  },

  async checkVerification(verificationId: string): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/verify/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ verification_id: verificationId }),
    });
    if (!res.ok) throw new Error('Failed to check verification');
    return res.json();
  },

  async createApi(data: Partial<ApiInfo>): Promise<ApiInfo> {
    const res = await fetch(`${BASE_URL}/apis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create API');
    return res.json();
  },

  async updateApiEndpoints(apiId: string, endpoints: ApiEndpoint[]): Promise<{ count: number }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ endpoints }),
    });
    if (!res.ok) throw new Error('Failed to save endpoints');
    return res.json();
  },

  async importEndpoints(apiId: string, specOrUrl: string): Promise<{ endpoints: ApiEndpoint[] }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ spec: specOrUrl }),
    });
    if (!res.ok) throw new Error('Failed to import OpenAPI spec');
    return res.json();
  },

  async setPricing(apiId: string, pricingData: PricingPayload): Promise<{ id: string }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/pricing`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(pricingData),
    });
    if (!res.ok) throw new Error('Failed to set pricing');
    return res.json();
  },

  async testApi(apiId: string): Promise<HealthReport> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/test`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to run tests');
    return res.json();
  },

  async publishApi(apiId: string): Promise<{ url: string }> {
    const res = await fetch(`${BASE_URL}/apis/${apiId}/publish`, {
      method: 'PUT',
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to publish API');
    return res.json();
  },

  async getDashboard(publisherId: string): Promise<DashboardResponse> {
    const res = await fetch(`${BASE_URL}/dashboard/${publisherId}`, {
      credentials: 'include',
      headers: { ...authHeaders() },
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
  async getWallet(publisherId: string): Promise<{ address?: string } | null> {
    const res = await fetch(`${BASE_URL}/publishers/${publisherId}/wallet`, {
      credentials: 'include',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error(`Could not read the payout wallet (${res.status})`);
    return res.json();
  },

  async getApis(): Promise<MarketplaceApi[]> {
    const res = await fetch(`${BASE_URL}/apis`);
    if (!res.ok) throw new Error('Failed to list APIs');
    return res.json();
  },

  async setWallet(
    publisherId: string,
    data: { address: string; chain?: string; settlement_frequency?: string; min_payout?: number },
  ): Promise<{ id: string; address: string }> {
    const res = await fetch(`${BASE_URL}/publishers/${publisherId}/wallet`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to set wallet');
    return res.json();
  },

  async settle(publisherId: string): Promise<SettleResult> {
    const res = await fetch(`${BASE_URL}/dashboard/${publisherId}/settle`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to add skill');
    return res.json();
  },
};
