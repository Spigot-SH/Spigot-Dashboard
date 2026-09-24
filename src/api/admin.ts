import { request } from './request';

export interface AdminOverview {
  users: { total: number; activeSessions: number };
  credits: { totalFloatUsdc: number; totalSpentUsdc: number; totalRechargedUsdc: number };
  promoCodes: { activeCodes: number; totalRedemptions: number };
  creditRequests?: { pendingCount: number; totalCount: number };
  whitelist: { count: number; enforced: boolean };
  emergency: { killSwitch: boolean; consumptionPaused: boolean; maintenanceMode: boolean };
}

export interface AdminCreditRequest {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  amount_usdc: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  current_balance: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  authProviders: string[];
  publisherId: string | null;
  balance: number;
  totalSpent: number;
  totalRecharged: number;
  isSuspended: boolean;
  suspensionReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserDetails {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    authProviders: string[];
    publisherId: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  };
  flags: {
    isSuspended: boolean;
    suspensionReason: string | null;
    suspendedAt: string | null;
    suspendedBy: string | null;
  };
  balances: {
    currentCredits: number;
    totalSpent: number;
    totalRecharged: number;
    chainBalances: unknown[];
  };
  wallets: {
    algorand: string | null;
    evm: string | null;
    solana: string | null;
    stellar: string | null;
  };
  transactions: Array<{
    id: string;
    kind: string;
    amount: number;
    balance_after: number;
    source: string;
    reference: string | null;
    description: string | null;
    metadata: string | null;
    created_at: string;
  }>;
  activeSessions: Array<{
    id: string;
    user_agent: string | null;
    created_at: string;
    expires_at: string;
  }>;
}

export interface WhitelistEntry {
  email: string;
  notes: string | null;
  addedBy: string | null;
  createdAt: string;
}

export interface PromoCode {
  code: string;
  amountUsdc: number;
  description: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export const adminApi = {
  getOverview: () =>
    request<{ ok: boolean; stats: AdminOverview; adminEmail: string }>('/admin/overview'),

  getUsers: (params?: { search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return request<{ ok: boolean; users: AdminUser[]; total: number; limit: number; offset: number }>(
      `/admin/users${q.toString() ? `?${q}` : ''}`,
    );
  },

  getUserDetails: (userId: string) =>
    request<{ ok: boolean } & UserDetails>(`/admin/users/${encodeURIComponent(userId)}`),

  adjustCredits: (userId: string, amount: number, description: string) =>
    request<{ ok: boolean; message: string; entry: unknown }>(
      `/admin/users/${encodeURIComponent(userId)}/adjust-credits`,
      {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      },
    ),

  toggleSuspend: (userId: string, isSuspended: boolean, reason?: string) =>
    request<{ ok: boolean; isSuspended: boolean; message: string }>(
      `/admin/users/${encodeURIComponent(userId)}/toggle-suspend`,
      {
        method: 'POST',
        body: JSON.stringify({ isSuspended, reason }),
      },
    ),

  revokeUserSessions: (userId: string) =>
    request<{ ok: boolean; revokedCount: number; message: string }>(
      `/admin/users/${encodeURIComponent(userId)}/revoke-sessions`,
      { method: 'POST' },
    ),

  getWhitelist: () =>
    request<{ ok: boolean; enforced: boolean; count: number; entries: WhitelistEntry[] }>(
      '/admin/whitelist',
    ),

  addToWhitelist: (data: { email?: string; emails?: string[]; notes?: string }) =>
    request<{ ok: boolean; addedCount: number; message: string; whitelist: WhitelistEntry[] }>(
      '/admin/whitelist',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    ),

  removeFromWhitelist: (email: string) =>
    request<{ ok: boolean; removed: boolean; message: string; whitelist: WhitelistEntry[] }>(
      `/admin/whitelist/${encodeURIComponent(email)}`,
      { method: 'DELETE' },
    ),

  toggleWhitelistEnforcement: (enabled: boolean) =>
    request<{ ok: boolean; enforced: boolean; message: string }>('/admin/whitelist/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  getPromoCodes: () =>
    request<{ ok: boolean; count: number; codes: PromoCode[] }>('/admin/promo-codes'),

  createPromoCode: (data: {
    code: string;
    amountUsdc: number;
    description: string;
    maxRedemptions?: number | null;
    expiresAt?: string | null;
  }) =>
    request<{ ok: boolean; promo: PromoCode; message: string }>('/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePromoCode: (
    code: string,
    updates: {
      active?: boolean;
      amountUsdc?: number;
      description?: string;
      maxRedemptions?: number | null;
      expiresAt?: string | null;
    },
  ) =>
    request<{ ok: boolean; promo: PromoCode; message: string }>(
      `/admin/promo-codes/${encodeURIComponent(code)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    ),

  deletePromoCode: (code: string) =>
    request<{ ok: boolean; deleted: boolean; message: string }>(
      `/admin/promo-codes/${encodeURIComponent(code)}`,
      { method: 'DELETE' },
    ),

  getEmergencyStatus: () =>
    request<{
      ok: boolean;
      status: { killSwitch: boolean; consumptionPaused: boolean; maintenanceMode: boolean };
    }>('/admin/emergency'),

  toggleEmergency: (
    key: 'emergency_kill_switch' | 'api_consumption_paused' | 'maintenance_mode',
    enabled: boolean,
  ) =>
    request<{
      ok: boolean;
      status: { killSwitch: boolean; consumptionPaused: boolean; maintenanceMode: boolean };
      message: string;
    }>('/admin/emergency/toggle', {
      method: 'POST',
      body: JSON.stringify({ key, enabled }),
    }),

  panicRevokeAllSessions: () =>
    request<{ ok: boolean; revokedCount: number; message: string }>(
      '/admin/emergency/panic-revoke-sessions',
      { method: 'POST' },
    ),

  getAuditLogs: (limit = 100) =>
    request<{ ok: boolean; count: number; logs: AuditLog[] }>(`/admin/audit-logs?limit=${limit}`),

  getCreditRequests: (status?: string) =>
    request<{ ok: boolean; count: number; requests: AdminCreditRequest[] }>(
      `/admin/credit-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),

  approveCreditRequest: (id: string, note?: string) =>
    request<{ ok: boolean; request: AdminCreditRequest; message: string }>(
      `/admin/credit-requests/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      },
    ),

  rejectCreditRequest: (id: string, note?: string) =>
    request<{ ok: boolean; request: AdminCreditRequest; message: string }>(
      `/admin/credit-requests/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      },
    ),
};
