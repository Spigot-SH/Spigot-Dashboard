'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Zap,
  Play,
  Server,
  Clock,
  Activity,
  ExternalLink,
  ShieldCheck,
  Wallet,
  Coins,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { EmptyState } from '../common/EmptyState';
import { ConsoleCover, CONSOLE_COVERS } from './ConsoleCover';
import { ApiTesterModal } from './ApiTesterModal';
import { AddCreditModal } from '../../credits/TopUpPanel';
import { PublishedApi, catalogApi } from '../../api/catalog';
import { creditsApi, CreditsOverview } from '../../api/credits';
import { useAuth } from '../../auth/AuthContext';
import { formatCredit } from '../../lib/format';
import { errorMessage } from '../../lib/errors';

interface ExploreApisViewProps {
  publisherId?: string;
}

export const ExploreApisView: React.FC<ExploreApisViewProps> = ({ publisherId: _publisherId }) => {
  const router = useRouter();
  const { credits, refresh } = useAuth();

  const [apis, setApis] = useState<PublishedApi[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected API for the interactive test modal
  const [activeTestApi, setActiveTestApi] = useState<PublishedApi | null>(null);

  // Add credit modal state
  const [addingCredit, setAddingCredit] = useState<boolean>(false);
  const [overview, setOverview] = useState<CreditsOverview | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fetchedApis, credOverview] = await Promise.all([
        catalogApi.getPublishedApis(),
        creditsApi.overview().catch(() => null),
      ]);
      setApis(fetchedApis);
      if (credOverview) setOverview(credOverview);
    } catch (err: unknown) {
      setLoadError(errorMessage(err, 'Failed to load published APIs.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered APIs by search term
  const filteredApis = useMemo(() => {
    if (!searchQuery.trim()) return apis;
    const q = searchQuery.toLowerCase().trim();
    return apis.filter(api => {
      const matchName = api.name.toLowerCase().includes(q);
      const matchSlug = api.slug.toLowerCase().includes(q);
      const matchPub = api.publisherName.toLowerCase().includes(q);
      const matchDesc = (api.description || '').toLowerCase().includes(q);
      const matchSkill = (api.skills || []).some(s => s.toLowerCase().includes(q));
      const matchEp = (api.endpoints || []).some(
        ep => ep.path.toLowerCase().includes(q) || ep.name.toLowerCase().includes(q),
      );
      return matchName || matchSlug || matchPub || matchDesc || matchSkill || matchEp;
    });
  }, [apis, searchQuery]);

  const totalEndpoints = useMemo(() => {
    return apis.reduce((sum, api) => sum + (api.endpoints?.length || 0), 0);
  }, [apis]);

  const currentBalance = credits ?? overview?.balance ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Console Cover Banner */}
      <ConsoleCover
        src={CONSOLE_COVERS.caller}
        title="Published APIs"
        subtitle="Explore monetized APIs available on Spigot and test them live. Calls are metered and settled per request in USDC via Algorand x402."
        action={
          <Button variant="primary" size="sm" onClick={() => setAddingCredit(true)}>
            <Wallet size={15} className="mr-1.5" /> Add credit
          </Button>
        }
      />

      {/* Add Credit Modal */}
      <AddCreditModal
        isOpen={addingCredit}
        onClose={() => setAddingCredit(false)}
        overview={overview}
        onCredited={() => {
          void refresh();
          void loadData();
        }}
      />

      {/* Interactive API Tester Modal */}
      <ApiTesterModal
        api={activeTestApi}
        isOpen={Boolean(activeTestApi)}
        onClose={() => setActiveTestApi(null)}
        onAddCredit={() => {
          setActiveTestApi(null);
          setAddingCredit(true);
        }}
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card hoverable className="relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 text-accent opacity-10">
            <Server size={64} />
          </div>
          <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
            Published APIs
          </h3>
          <div className="text-3xl font-semibold text-main">
            {loading ? '-' : apis.length.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-muted">
            {totalEndpoints} monetized endpoints available
          </div>
        </Card>

        <Card hoverable className="relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 text-accent opacity-10">
            <Coins size={64} />
          </div>
          <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
            Your Credit Balance
          </h3>
          <div className="text-3xl font-semibold text-accent font-mono">
            {formatCredit(currentBalance)}
          </div>
          <div className="mt-1 text-xs text-muted">Spendable across all published APIs</div>
        </Card>

        <Card hoverable className="relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 text-accent opacity-10">
            <ShieldCheck size={64} />
          </div>
          <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
            Payment Protocol
          </h3>
          <div className="text-3xl font-semibold text-main font-mono">x402 / USDC</div>
          <div className="mt-1 text-xs text-muted">Algorand Testnet · Gasless for callers</div>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search published APIs, endpoints, or keywords..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel py-2.5 pl-10 pr-4 text-sm text-main placeholder-muted/60 focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            Showing <strong className="text-main">{filteredApis.length}</strong> of{' '}
            {apis.length} APIs
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size={36} className="text-accent mb-4" />
          <p className="text-sm text-muted">Loading published APIs...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && loadError && (
        <EmptyState
          title="Could not load published APIs"
          description={loadError}
          action={
            <Button variant="primary" size="sm" onClick={() => void loadData()}>
              Try again
            </Button>
          }
        />
      )}

      {/* Empty State */}
      {!loading && !loadError && filteredApis.length === 0 && (
        <Card padding="none">
          <div className="py-16 text-center">
            <Server size={44} className="mx-auto text-muted opacity-40 mb-3" />
            <h3 className="text-base font-semibold text-main mb-1">
              {searchQuery ? 'No APIs match your search' : 'No published APIs found'}
            </h3>
            <p className="text-xs text-muted max-w-md mx-auto mb-6">
              {searchQuery
                ? `No published APIs matching "${searchQuery}". Try searching for another keyword or clear the search.`
                : 'There are no published APIs listed in the marketplace yet.'}
            </p>
            {searchQuery && (
              <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* API Cards Grid */}
      {!loading && !loadError && filteredApis.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredApis.map(api => {
            const cost = api.pricePerRequest ?? 0;
            const endpoints = api.endpoints || [];
            const previewEndpoints = endpoints.slice(0, 3);
            const remainingCount = Math.max(0, endpoints.length - 3);

            return (
              <Card
                key={api.id}
                hoverable
                className="flex flex-col justify-between p-6 transition-all duration-200 border-border hover:border-accent/40"
              >
                <div>
                  {/* Top Bar: Title & Price Badge */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-lg font-semibold text-main truncate">{api.name}</h4>
                        <span className="rounded bg-panel-hover border border-border px-2 py-0.5 font-mono text-[0.7rem] text-muted">
                          {api.slug}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
                        <Zap size={13} />
                        {cost > 0 ? `$${cost.toFixed(4)} / call` : 'Free'}
                      </span>
                    </div>
                  </div>

                  {/* Skills / Tags */}
                  {api.skills && api.skills.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-4">
                      {api.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-bg border border-border px-2 py-0.5 text-[0.7rem] text-muted font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-bg/50 border border-border/80 p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-muted shrink-0" />
                      <div className="text-xs">
                        <span className="text-muted">Avg Latency: </span>
                        <span className="font-mono text-main font-medium">
                          {api.avgLatency ? `${Math.round(api.avgLatency)}ms` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-muted shrink-0" />
                      <div className="text-xs">
                        <span className="text-muted">Uptime: </span>
                        <span className="font-mono text-emerald-400 font-medium">
                          {api.uptime ? `${Math.round(api.uptime)}%` : '100%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Endpoints Preview List */}
                  <div className="space-y-1.5 mb-6">
                    <div className="text-[0.7rem] uppercase tracking-wider text-muted font-semibold mb-1">
                      Monetized Endpoints ({endpoints.length})
                    </div>
                    {previewEndpoints.map(ep => {
                      const methodColor =
                        ep.method === 'GET'
                          ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                          : ep.method === 'POST'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : ep.method === 'DELETE'
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

                      return (
                        <div
                          key={ep.id}
                          className="flex items-center gap-2 rounded-lg border border-border/70 bg-bg/40 px-3 py-1.5 text-xs font-mono"
                        >
                          <span
                            className={`rounded px-1.5 py-0.2 font-bold text-[0.65rem] border ${methodColor}`}
                          >
                            {ep.method}
                          </span>
                          <span className="text-main truncate">{ep.path}</span>
                          {ep.name && (
                            <span className="text-muted text-[0.7rem] ml-auto font-sans truncate hidden sm:inline">
                              {ep.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {remainingCount > 0 && (
                      <p className="text-[0.7rem] text-muted italic pl-1">
                        +{remainingCount} more endpoint{remainingCount > 1 ? 's' : ''} available
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => router.push(`/test/${api.slug}`)}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-main cursor-pointer transition-colors"
                  >
                    Full Test Page <ExternalLink size={12} />
                  </button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTestApi(api)}
                  >
                    <Play size={13} className="mr-1.5 fill-current" /> Test API
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExploreApisView;
