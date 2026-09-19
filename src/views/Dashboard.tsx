'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Table, Th, Td, TdEmpty } from '../components/common/Table';
import { UNKNOWN, truncateMiddle } from '../lib/format';
import { Activity, CreditCard, Network, CheckCircle, Clock, Plus } from 'lucide-react';
import {
  apiClient,
  DashboardStats,
  type DashboardEndpointRow,
  type DashboardSettlementRow,
  type DashboardTransactionRow,
  getPublisherId,
  setPublisherId,
} from '../api/client';
import SettlePanel from '../components/dashboard/SettlePanel';
import { ApisView } from '../components/dashboard/ApisView';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { SettingsView } from '../components/dashboard/SettingsView';
import { useAuth } from '../auth/AuthContext';

interface DashboardProps {
  /** Supplied by the route segment, which reads the param server-side and passes it down. */
  publisherId: string;
  section?: string;
}

const EMPTY_STATS: DashboardStats = {
  availableBalance: 0,
  pendingBalance: 0,
  totalRequests: 0,
  successRate: 100,
  endpoints: [],
  transactions: [],
  health: {
    uptime: 100,
    avgLatency: 0,
    status: 'ONLINE',
  },
  settlements: [],
};

function settlementStatus(status: unknown): 'PUBLISHED' | 'PENDING' | 'OFFLINE' {
  switch (String(status).toUpperCase()) {
    case 'COMPLETED':
      return 'PUBLISHED';
    case 'FAILED':
      return 'OFFLINE';
    default:
      return 'PENDING';
  }
}

const Dashboard: React.FC<DashboardProps> = ({ publisherId, section }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, refresh, signedIn, openSignIn } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeSection = useMemo(() => {
    if (section && section !== 'overview') return section;
    if (pathname?.endsWith('/apis')) return 'apis';
    if (pathname?.endsWith('/analytics')) return 'analytics';
    if (pathname?.endsWith('/settings')) return 'settings';
    return 'overview';
  }, [section, pathname]);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const targetId = publisherId || 'active';
        let raw = await apiClient.getDashboard(targetId);

        // Auto-register publisher for signed-in user if not yet registered
        if (raw?.error && signedIn && user) {
          try {
            const name = user.email ? user.email.split('@')[0] : 'My Publisher';
            const pub = await apiClient.registerPublisher({ name });
            if (pub.id) {
              setPublisherId(pub.id);
            }
            await refresh();
            raw = await apiClient.getDashboard(pub.id || targetId);
          } catch (regErr: unknown) {
            console.warn('Auto publisher registration attempt handled:', regErr);
          }
        }

        if (!isMounted) return;

        if (raw && !raw.error) {
          if (raw.publisherId) {
            setPublisherId(raw.publisherId);
          }

          const mapped: DashboardStats = {
            availableBalance: Number(raw.available ?? raw.availableBalance ?? 0),
            pendingBalance: Number(raw.pending ?? raw.pendingBalance ?? 0),
            totalRequests: Number(
              (raw.requests_today ?? 0) + (raw.requests_month ?? 0) || raw.totalRequests || 0,
            ),
            successRate: Number(raw.success_rate ?? raw.successRate ?? 100),
            endpoints: Array.isArray(raw.endpoints) ? raw.endpoints : [],
            transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
            health: raw.health || {
              uptime: 100,
              avgLatency: Number(raw.avg_latency ?? 0),
              status: raw.health_status ?? 'ONLINE',
            },
            settlements: Array.isArray(raw.settlements) ? raw.settlements : [],
          };
          setStats(mapped);
        } else {
          setStats(EMPTY_STATS);
        }
        setLoading(false);
      } catch (err: unknown) {
        console.warn('Dashboard fetch fallback to zero-state:', err);
        if (isMounted) {
          setStats(EMPTY_STATS);
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [publisherId, refreshKey, signedIn, user, refresh]);

  if (loading || !stats) {
    return (
      <div className="flex">
        <Sidebar publisherId={publisherId || 'active'} />
        <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="flex flex-col items-center text-muted">
            <Activity className="mb-4 text-accent" size={48} />
            <p className="text-lg">Loading Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const effectivePublisherId = getPublisherId() || publisherId || 'active';

  return (
    <div className="flex">
      <Sidebar publisherId={effectivePublisherId} />

      <div className="flex-1 p-8 overflow-y-auto h-[calc(100vh-64px)]">
        <div className="max-w-[1400px] mx-auto">
          {/* Guest notification banner */}
          {!signedIn && (
            <div className="mb-6 p-4 rounded-lg bg-panel border border-border flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs bg-accent/20 text-accent font-medium uppercase tracking-wider">
                  Guest Mode
                </span>
                <span className="text-sm text-main">
                  Sign in with email to link your Algorand payout wallet, register new endpoints,
                  and collect USDC revenue.
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={openSignIn}>
                Sign In
              </Button>
            </div>
          )}

          {/* Render Active Section */}
          {activeSection === 'apis' && (
            <ApisView stats={stats} publisherId={effectivePublisherId} />
          )}

          {activeSection === 'analytics' && <AnalyticsView stats={stats} />}

          {activeSection === 'settings' && <SettingsView publisherId={effectivePublisherId} />}

          {activeSection === 'overview' && (
            <>
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h1 className="text-3xl mb-1 text-accent">Publisher Dashboard</h1>
                  <p className="text-muted">
                    Welcome back. Here&apos;s real-time telemetry and revenue performance for your
                    APIs.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-panel px-4 py-2 rounded-lg border border-border">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                  </span>
                  <span className="text-sm font-medium">
                    System {stats.health?.status || 'ONLINE'}
                  </span>
                </div>
              </div>

              <SettlePanel
                publisherId={effectivePublisherId}
                available={stats.availableBalance ?? 0}
                onSettled={() => setRefreshKey(k => k + 1)}
              />

              {/* Top Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent">
                    <CreditCard size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Available Balance
                  </h3>
                  <div className="text-3xl flex items-baseline gap-2">
                    {(stats.availableBalance ?? 0).toFixed(4)}{' '}
                    <span className="text-base text-muted font-normal">USDC</span>
                  </div>
                </Card>

                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent-dim">
                    <Clock size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Pending Balance
                  </h3>
                  <div className="text-3xl flex items-baseline gap-2">
                    {(stats.pendingBalance ?? 0).toFixed(4)}{' '}
                    <span className="text-base text-muted font-normal">USDC</span>
                  </div>
                </Card>

                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent">
                    <Network size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Total Requests
                  </h3>
                  <div className="text-3xl font-mono">
                    {(stats.totalRequests ?? 0).toLocaleString()}
                  </div>
                </Card>

                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent-dim">
                    <CheckCircle size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Success Rate
                  </h3>
                  <div className="text-3xl text-accent font-mono">{stats.successRate ?? 100}%</div>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Endpoints Table - spans 2 columns */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <Card
                    header={
                      <div className="flex justify-between items-center">
                        <span>Endpoint Performance</span>
                        <button
                          type="button"
                          onClick={() => router.push('/onboarding')}
                          className="text-xs text-accent hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Plus size={13} /> Add Endpoint
                        </button>
                      </div>
                    }
                    padding="none"
                  >
                    <Table>
                      <thead>
                        <tr>
                          <Th>Endpoint Path</Th>
                          <Th>Method</Th>
                          <Th numeric>Requests</Th>
                          <Th numeric>Revenue (USDC)</Th>
                          <Th numeric>Avg Latency</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.endpoints && stats.endpoints.length > 0 ? (
                          stats.endpoints.map((ep: DashboardEndpointRow, i: number) => {
                            const reqCount = Number(ep.request_count ?? ep.requests ?? 0);
                            const rev = Number(ep.total_revenue ?? ep.revenue ?? 0);
                            const lat = Number(ep.avg_latency ?? ep.latency ?? 0);
                            return (
                              <tr key={i}>
                                <Td mono>{ep.path || '/'}</Td>
                                <Td>
                                  <span className="px-2 py-1 rounded text-xs bg-panel-hover text-main font-mono">
                                    {ep.method || 'GET'}
                                  </span>
                                </Td>
                                <Td numeric>{reqCount.toLocaleString()}</Td>
                                <Td numeric className="text-accent font-medium">
                                  {rev.toFixed(4)} USDC
                                </Td>
                                <Td numeric mono>
                                  {Math.round(lat)}ms
                                </Td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <TdEmpty colSpan={5}>
                              <div className="py-6 text-center">
                                <p className="mb-2">No endpoints configured yet</p>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => router.push('/onboarding')}
                                >
                                  Publish Your First API
                                </Button>
                              </div>
                            </TdEmpty>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card>

                  <Card header="Settlement History" padding="none">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Date</Th>
                          <Th numeric>Amount (USDC)</Th>
                          <Th>Tx Hash</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.settlements && stats.settlements.length > 0 ? (
                          stats.settlements.map((s: DashboardSettlementRow, i: number) => {
                            const amt = Number(s.amount || 0);
                            const dateStr = String(
                              s.created_at || s.period_end || s.date || 'Recent',
                            );
                            const tx = String(s.tx_id || s.txHash || s.id || UNKNOWN);
                            return (
                              <tr key={i}>
                                <Td>{dateStr.slice(0, 10)}</Td>
                                <Td numeric className="font-medium">
                                  {amt.toFixed(4)} USDC
                                </Td>
                                <Td mono className="text-accent" title={tx}>
                                  {truncateMiddle(tx)}
                                </Td>
                                <Td>
                                  <StatusBadge status={settlementStatus(s.status)} />
                                </Td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <TdEmpty colSpan={4}>No settlements processed yet</TdEmpty>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card>
                </div>

                {/* Sidebar Data - spans 1 column */}
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <Card header="Recent Transactions">
                    <div className="flex flex-col gap-4">
                      {stats.transactions && stats.transactions.length > 0 ? (
                        stats.transactions.map((tx: DashboardTransactionRow, i: number) => {
                          const amt = Number(tx.amount || 0);
                          const txHash = String(tx.tx_id || tx.id || UNKNOWN);
                          const timeStr = String(tx.created_at || tx.time || '');
                          return (
                            <div
                              key={i}
                              className="flex justify-between items-center p-3 bg-bg rounded border border-border"
                            >
                              <div>
                                <div className="font-mono text-xs text-muted mb-1" title={txHash}>
                                  {truncateMiddle(txHash, 8, 6)}
                                </div>
                                <div className="text-xs text-muted">
                                  {timeStr.slice(0, 16).replace('T', ' ')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-accent text-sm font-medium">+{amt} USDC</div>
                                <div className="text-xs text-muted mt-1">
                                  {tx.status || 'CONFIRMED'}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted">
                          No transactions recorded yet
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card header="System Health">
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Uptime (30d)</span>
                        <span className="font-medium text-sm text-accent">
                          {stats.health?.uptime ?? 100}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-panel rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${stats.health?.uptime ?? 100}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-2">
                        <span className="text-muted text-sm">Avg Global Latency</span>
                        <span className="font-medium text-sm font-mono">
                          {stats.health?.avgLatency ?? 0}ms
                        </span>
                      </div>
                      <div className="w-full h-2 bg-panel rounded-full overflow-hidden">
                        <div className="h-full w-[45%] bg-accent-dim" />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
