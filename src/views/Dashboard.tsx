'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { Table, Th, Td, TdEmpty } from '../components/common/Table';
import { UNKNOWN, truncateMiddle } from '../lib/format';
import { errorMessage } from '../lib/errors';
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
import { ExploreApisView } from '../components/dashboard/ExploreApisView';
import { CallerView } from '../components/dashboard/CallerView';
import { ConsoleCover, CONSOLE_COVERS } from '../components/dashboard/ConsoleCover';
import { McpOnboardingBanner } from '../components/dashboard/McpOnboardingBanner';
import { McpTutorialModal } from '../components/dashboard/McpTutorialModal';
import { TutorialLockedCard } from '../components/dashboard/TutorialLockedCard';
import { creditsApi } from '../api/credits';
import { useAuth } from '../auth/AuthContext';
import { consoleFallback, useConsoleView } from '../lib/consoleView';
import { Logo } from '../components/common/Logo';

interface DashboardProps {
  /** Supplied by the route segment, which reads the param server-side and passes it down. */
  publisherId: string;
  section?: string;
}

const EMPTY_STATS: DashboardStats = {
  availableBalance: 0,
  pendingBalance: 0,
  requestsToday: 0,
  requestsMonth: 0,
  successRate: null,
  endpoints: [],
  transactions: [],
  health: {
    avgLatency: 0,
    status: null,
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
  const { user, publisher, credits, refresh } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // A failed load is not an empty account: never show zeros for it.
  const [loadError, setLoadError] = useState<string | null>(null);
  // The switch is in the header now, so the answer lives outside this component, and the
  // fallback is derived in one place so the two cannot disagree on the first paint.
  const { view } = useConsoleView(consoleFallback(user?.profile?.intent));

  // Blocking tutorial & unlock state: user cannot access full dashboard until unlocked & tutorial completed
  const [tutorialUnlocked, setTutorialUnlocked] = useState<boolean>(true);
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(true);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [checkedTutorial, setCheckedTutorial] = useState<boolean>(false);

  useEffect(() => {
    try {
      const unlocked = localStorage.getItem('spigot_mcp_unlocked') === 'true';
      const completed = localStorage.getItem('spigot_mcp_tutorial_completed') === 'true';
      setTutorialUnlocked(unlocked);
      setTutorialCompleted(completed);
      // Auto-show modal if unlocked but not yet completed
      if (unlocked && !completed) {
        setShowTutorialModal(true);
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setCheckedTutorial(true);
    }
  }, []);

  const handleUnlockTutorial = async () => {
    setIsUnlocking(true);
    try {
      try {
        await creditsApi.unlockTutorial();
      } catch (err: unknown) {
        console.warn('Backend unlock completed or fell back:', err);
      }
      try {
        localStorage.setItem('spigot_mcp_unlocked', 'true');
      } catch {}
      setTutorialUnlocked(true);
      setShowTutorialModal(true);
      void refresh();
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleTutorialComplete = () => {
    try {
      localStorage.setItem('spigot_mcp_unlocked', 'true');
      localStorage.setItem('spigot_mcp_tutorial_completed', 'true');
    } catch {}
    setTutorialUnlocked(true);
    setTutorialCompleted(true);
    setShowTutorialModal(false);
  };

  const isDashboardBlocked = checkedTutorial && (!tutorialUnlocked || !tutorialCompleted);

  const activeSection = useMemo(() => {
    if (section && section !== 'overview') return section;
    if (pathname?.endsWith('/apis')) return 'apis';
    if (pathname?.endsWith('/explore')) return 'explore';
    if (pathname?.endsWith('/analytics')) return 'analytics';
    if (pathname?.endsWith('/settings')) return 'settings';
    return 'overview';
  }, [section, pathname]);

  useEffect(() => {
    let isMounted = true;

    // The caller console reads its own data. Do not ask for a publisher dashboard the person
    // may not have — that request is what used to auto-create a publisher account for them.
    if (view !== 'provider') {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const targetId = publisherId || 'active';
        // Read only. Opening a page must never create a publisher account behind someone's
        // back — `/start` asks first, and the empty state below links to it.
        const raw = await apiClient.getDashboard(targetId);

        if (!isMounted) return;

        if (raw && !raw.error) {
          if (raw.publisherId) {
            setPublisherId(raw.publisherId);
          }

          const mapped: DashboardStats = {
            availableBalance: Number(raw.available ?? raw.availableBalance ?? 0),
            pendingBalance: Number(raw.pending ?? raw.pendingBalance ?? 0),
            requestsToday: Number(raw.requests_today ?? 0),
            requestsMonth: Number(raw.requests_month ?? 0),
            // The rate and the latency are averages over every request ever made. An older
            // backend sends 100 with no requests, so only trust them once an endpoint has traffic.
            successRate:
              raw.success_rate != null &&
              (raw.endpoints ?? []).some(ep => Number(ep.request_count ?? ep.requests ?? 0) > 0)
                ? Number(raw.success_rate)
                : null,
            endpoints: Array.isArray(raw.endpoints) ? raw.endpoints : [],
            transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
            health: {
              avgLatency: Number(raw.avg_latency ?? 0),
              status: raw.health_status ?? null,
            },
            settlements: Array.isArray(raw.settlements) ? raw.settlements : [],
          };
          setStats(mapped);
          setLoadError(null);
        } else {
          setStats(EMPTY_STATS);
          setLoadError(raw?.error || 'Could not load your dashboard.');
        }
        setLoading(false);
      } catch (err: unknown) {
        if (isMounted) {
          setStats(EMPTY_STATS);
          setLoadError(errorMessage(err, 'Could not load your dashboard.'));
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [publisherId, refreshKey, view]);

  const effectivePublisherId = getPublisherId() || publisherId || 'active';
  // Signed in with no publisher: there is nothing to load yet, so say that, not an error.
  const needsAccount = !publisher;
  // The route is gated, so a signed-out visitor never gets here. Figures wait on a real load.
  const showFigures = !loadError && !needsAccount && Boolean(stats);

  if (view === 'caller') {
    return (
      <>
        <McpTutorialModal
          isOpen={showTutorialModal}
          onComplete={handleTutorialComplete}
          canClose={tutorialUnlocked && tutorialCompleted}
          onClose={() => setShowTutorialModal(false)}
        />
        <div className="flex">
          <div className={isDashboardBlocked ? 'pointer-events-none opacity-50 select-none' : ''}>
            <Sidebar publisherId={effectivePublisherId} view="caller" />
          </div>
          <div className="h-[calc(100vh-64px)] flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-[1400px]">
              {/* The caller console used to render `CallerView` for every section, so the
                  settings page existed but nothing in this view could reach it. */}
              {activeSection === 'settings' ? (
                <SettingsView publisherId={effectivePublisherId} />
              ) : activeSection === 'explore' ? (
                <ExploreApisView publisherId={effectivePublisherId} />
              ) : (
                <CallerView
                  publisherId={effectivePublisherId}
                  isUnlocked={tutorialUnlocked}
                  isCompleted={tutorialCompleted}
                  onOpenTutorial={() => setShowTutorialModal(true)}
                  onUnlockTutorial={handleUnlockTutorial}
                  isUnlocking={isUnlocking}
                />
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loading || !stats) {
    return (
      <>
        <McpTutorialModal
          isOpen={showTutorialModal}
          onComplete={handleTutorialComplete}
          canClose={tutorialUnlocked && tutorialCompleted}
          onClose={() => setShowTutorialModal(false)}
        />
        <div className="flex">
          <Sidebar publisherId={publisherId || 'active'} />
          <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)]">
            <div className="flex flex-col items-center text-muted">
              <Activity className="mb-4 text-accent" size={48} />
              <p className="text-lg">Loading Dashboard...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <McpTutorialModal
        isOpen={showTutorialModal}
        onComplete={handleTutorialComplete}
        canClose={tutorialUnlocked && tutorialCompleted}
        onClose={() => setShowTutorialModal(false)}
      />
      <div className="flex">
        <div className={isDashboardBlocked ? 'pointer-events-none opacity-50 select-none' : ''}>
          <Sidebar publisherId={effectivePublisherId} />
        </div>

        <div className="h-[calc(100vh-64px)] flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="max-w-[1400px] mx-auto">
            {needsAccount && (
              <EmptyState
                icon={<Logo size={56} className="text-accent" />}
                title="No publisher account yet"
                description="Your publisher console starts once you create one. It takes one click. Only calling APIs? Switch to Use APIs above."
                action={
                  <Button variant="primary" onClick={() => router.push('/start')}>
                    Set up as a provider
                  </Button>
                }
              />
            )}

            {loadError && !needsAccount && (
              <EmptyState
                title="Could not load your dashboard"
                description={`${loadError} No figures are shown, because none loaded.`}
                action={
                  <Button variant="primary" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
                    Try again
                  </Button>
                }
              />
            )}

            {/* Render Active Section */}
            {activeSection === 'explore' && (
              <ExploreApisView publisherId={effectivePublisherId} />
            )}

            {showFigures && activeSection === 'apis' && (
              <ApisView stats={stats} publisherId={effectivePublisherId} />
            )}

            {showFigures && activeSection === 'analytics' && <AnalyticsView stats={stats} />}

            {/* Not behind `showFigures`: settings reads no dashboard figures, and a failed
                stats request used to take the API key and the payout address down with it. */}
            {activeSection === 'settings' && <SettingsView publisherId={effectivePublisherId} />}

            {showFigures && activeSection === 'overview' && (
              <>
                <ConsoleCover
                  src={CONSOLE_COVERS.provider}
                  title="Your APIs"
                  subtitle={
                    stats.health.status
                      ? `What your endpoints have earned and served. Last health check: ${stats.health.status}.`
                      : 'What your endpoints have earned and served. No health check has run yet.'
                  }
                />

                {!tutorialUnlocked || !tutorialCompleted ? (
                  <TutorialLockedCard
                    balance={credits ?? 0}
                    onAddCredit={() => router.push('/profile')}
                    onUnlock={handleUnlockTutorial}
                    isUnlocking={isUnlocking}
                    className="mb-8"
                  />
                ) : (
                  <McpOnboardingBanner
                    className="mb-8"
                    onOpenTutorial={() => setShowTutorialModal(true)}
                  />
                )}

                <div
                  className={`transition-all duration-300 ${
                    isDashboardBlocked
                      ? 'pointer-events-none select-none filter blur-[2px] opacity-40'
                      : ''
                  }`}
                >
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
                    ${(stats.availableBalance ?? 0).toFixed(4)}
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
                    ${(stats.pendingBalance ?? 0).toFixed(4)}
                  </div>
                </Card>

                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent">
                    <Network size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Requests this month
                  </h3>
                  <div className="text-3xl font-mono">{stats.requestsMonth.toLocaleString()}</div>
                  <div className="text-xs text-muted mt-1">
                    Today: {stats.requestsToday.toLocaleString()}
                  </div>
                </Card>

                <Card hoverable className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-accent-dim">
                    <CheckCircle size={64} />
                  </div>
                  <h3 className="text-sm text-muted font-normal uppercase tracking-wider mb-2">
                    Success Rate
                  </h3>
                  <div className="text-3xl text-accent font-mono">
                    {stats.successRate === null ? UNKNOWN : `${stats.successRate}%`}
                  </div>
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
                          <Th numeric>Revenue</Th>
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
                                  ${rev.toFixed(4)}
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
                          <Th numeric>Amount</Th>
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
                                  ${amt.toFixed(4)}
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
                                <div className="text-accent text-sm font-medium">+${amt}</div>
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
                        <span className="text-muted text-sm">Last health check</span>
                        <span className="font-medium text-sm">
                          {stats.health.status ?? 'None yet'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Average latency, all requests</span>
                        <span className="font-medium text-sm font-mono">
                          {stats.successRate === null ? UNKNOWN : `${stats.health.avgLatency}ms`}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  </>
);
};

export default Dashboard;
