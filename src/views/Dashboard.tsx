'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Table, Th, Td, TdEmpty } from '../components/common/Table';
import { UNKNOWN, truncateMiddle } from '../lib/format';
import { Activity, CreditCard, Network, CheckCircle, Clock, Lock } from 'lucide-react';
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
import { useAuth } from '../auth/AuthContext';

const DEMO_STATS: DashboardStats = {
  availableBalance: 1250.5,
  pendingBalance: 142.3,
  totalRequests: 48290,
  successRate: 99.8,
  endpoints: [
    {
      path: '/v1/models/gpt-4/chat',
      method: 'POST',
      request_count: 28400,
      total_revenue: 710.0,
      avg_latency: 245,
    },
    {
      path: '/v1/embeddings',
      method: 'POST',
      request_count: 14350,
      total_revenue: 143.5,
      avg_latency: 85,
    },
    {
      path: '/v1/images/generations',
      method: 'POST',
      request_count: 5540,
      total_revenue: 397.0,
      avg_latency: 1250,
    },
  ],
  transactions: [
    {
      id: 'tx_demo_01',
      tx_id: 'tx_demo_01c87102e3b1c9024',
      amount: 0.05,
      status: 'CONFIRMED',
      created_at: '2026-09-19T10:30:00.000Z',
    },
    {
      id: 'tx_demo_02',
      tx_id: 'tx_demo_02f9482710385920a',
      amount: 0.025,
      status: 'CONFIRMED',
      created_at: '2026-09-19T10:15:00.000Z',
    },
    {
      id: 'tx_demo_03',
      tx_id: 'tx_demo_03e1984271839201f',
      amount: 0.1,
      status: 'CONFIRMED',
      created_at: '2026-09-19T09:50:00.000Z',
    },
  ],
  health: {
    uptime: 99.98,
    avgLatency: 142,
    status: 'ONLINE',
  },
  settlements: [
    {
      id: 'stl_demo_01',
      tx_id: '0x3a8f902b1c9e8471629471928374619283746192837461928374619283746192',
      amount: 850.0,
      status: 'COMPLETED',
      created_at: '2026-09-17T12:00:00.000Z',
    },
    {
      id: 'stl_demo_02',
      tx_id: '0x1928374619283746192837461928374619283746192837461928374619283746',
      amount: 400.5,
      status: 'COMPLETED',
      created_at: '2026-09-10T12:00:00.000Z',
    },
  ],
};

interface DashboardProps {
  /** Supplied by the route segment, which reads the param server-side and passes it down. */
  publisherId: string;
}

/**
 * Settlements are `PENDING | PROCESSING | COMPLETED | FAILED` in the backend, which is not the
 * vocabulary StatusBadge speaks. Every row used to render `ONLINE` regardless of its real
 * state, so a failed settlement looked identical to a completed one.
 *
 * Anything unrecognised falls to PENDING rather than to a success state: reporting "settled"
 * for a status we cannot read is the one wrong answer here.
 */
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

const Dashboard: React.FC<DashboardProps> = ({ publisherId }) => {
  const router = useRouter();
  const { user, publisher, refresh, signedIn } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEnableDemo = () => {
    setStats(DEMO_STATS);
    setIsDemo(true);
    setAccessDenied(false);
    setLoading(false);
  };

  const handleQuickRegister = async () => {
    setRegistering(true);
    try {
      const name = user?.email ? user.email.split('@')[0] : 'My Publisher';
      const pub = await apiClient.registerPublisher({ name });
      if (pub.id) {
        setPublisherId(pub.id);
      }
      await refresh();
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      console.warn('1-click registration failed, falling back to demo mode:', err);
      handleEnableDemo();
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (publisherId === 'demo') {
      handleEnableDemo();
      return;
    }

    const fetchStats = async () => {
      try {
        const targetId = publisherId || 'active';
        const raw = await apiClient.getDashboard(targetId);

        if (raw.error) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

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
        setIsDemo(false);
        setAccessDenied(false);
        setLoading(false);
      } catch (err: unknown) {
        console.warn('Dashboard fetch failed:', err);
        setAccessDenied(true);
        setLoading(false);
      }
    };

    fetchStats();
  }, [publisherId, refreshKey]);

  if (accessDenied) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center px-6">
        <Card padding="lg" className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-panel-hover border border-border flex items-center justify-center mb-6 text-main">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl mb-3 text-main">Dashboard Access Restricted</h2>
          <p className="text-muted mb-8 max-w-md">
            You can only view your own publisher dashboard. Please register as a publisher to view
            your API performance and revenue metrics, or explore the dashboard in demo mode.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {signedIn && !publisher && (
              <Button variant="primary" disabled={registering} onClick={handleQuickRegister}>
                {registering ? 'Registering...' : '1-Click Register as Publisher'}
              </Button>
            )}
            <Button
              variant={signedIn && !publisher ? 'secondary' : 'primary'}
              onClick={handleEnableDemo}
            >
              Explore Demo Dashboard
            </Button>
            <Button variant="secondary" onClick={() => router.push('/onboarding')}>
              Publish API & Register
            </Button>
            <Button variant="secondary" onClick={() => router.push('/')}>
              Back to Marketplace
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex">
        <Sidebar publisherId={publisherId || ''} />
        <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="flex flex-col items-center text-muted">
            <Activity className=" mb-4 text-accent" size={48} />
            <p className="text-lg">Loading Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar publisherId={publisherId || ''} />

      <div className="flex-1 p-8 overflow-y-auto h-[calc(100vh-64px)]">
        <div className="max-w-[1400px] mx-auto">
          {isDemo && (
            <div className="mb-6 p-4 rounded-lg bg-panel border border-accent/30 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs bg-accent text-bg font-medium uppercase tracking-wider">
                  Demo Mode
                </span>
                <span className="text-sm text-main">
                  You are viewing sample metrics. Register as a publisher to view live API traffic
                  and revenue.
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/onboarding')}>
                Register as Publisher
              </Button>
            </div>
          )}

          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl mb-1 text-accent">Publisher Dashboard</h1>
              <p className="text-muted">Welcome back. Here&apos;s how your APIs are performing.</p>
            </div>
            <div className="flex items-center gap-3 bg-panel px-4 py-2 rounded-lg border border-border">
              <span className="relative flex h-3 w-3">
                <span className=" absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
              </span>
              <span className="text-sm font-medium">System {stats.health?.status || 'ONLINE'}</span>
            </div>
          </div>

          <SettlePanel
            publisherId={getPublisherId() || publisherId || ''}
            available={stats.availableBalance ?? 0}
            onSettled={() => setRefreshKey(k => k + 1)}
          />

          {/* Top Stat Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
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
              <div className="text-3xl">{(stats.totalRequests ?? 0).toLocaleString()}</div>
            </Card>

            <Card hoverable className="relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-accent-dim">
                <CheckCircle size={64} />
              </div>
              <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                Success Rate
              </h3>
              <div className="text-3xl text-accent">{stats.successRate ?? 100}%</div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-3 gap-8">
            {/* Endpoints Table - spans 2 columns */}
            <div className="col-span-2 flex flex-col gap-8">
              <Card header="Endpoint Performance" padding="none">
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
                        <TdEmpty colSpan={5}>No endpoints configured yet</TdEmpty>
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
                        const dateStr = String(s.created_at || s.period_end || s.date || 'Recent');
                        const tx = String(s.tx_id || s.txHash || s.id || UNKNOWN);
                        return (
                          <tr key={i}>
                            <Td>{dateStr.slice(0, 10)}</Td>
                            <Td numeric className="font-medium">
                              {amt.toFixed(4)} USDC
                            </Td>
                            {/* Both ends of a hash carry meaning, so the middle goes, not
                                  the tail. `title` keeps the full value reachable. */}
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
            <div className="col-span-1 flex flex-col gap-8">
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
                    {/* Inline style is required: the width is a runtime value, so Tailwind
                        cannot generate a class for it ahead of time. */}
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
