'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Table, Th, Td, TdEmpty } from '../common/Table';
import { DashboardStats, DashboardEndpointRow } from '../../api/client';
import { Server, Plus, Copy, Check, ExternalLink } from 'lucide-react';
import { buildPublishedGatewayUrl } from '../../lib/gatewayUrl';

/**
 * `DashboardEndpointRow` (src/api/client.ts) has no status field: the dashboard endpoints
 * query (Spigot-Algorand/backend/src/routes/dashboard.ts, `endpoints` query, ~line 132-142)
 * does not select `apis.status`. Read it defensively under an extended type so this still
 * works once that field is added, without widening the shared row type here (owned by another
 * change). Until the backend adds it, `api_status` is always undefined and every row fails
 * closed to no URL — see buildPublishedGatewayUrl in ../../lib/gatewayUrl.
 */
type EndpointRowWithStatus = DashboardEndpointRow & { api_status?: string; status?: string };

interface ApisViewProps {
  stats: DashboardStats;
  publisherId?: string;
}

export const ApisView: React.FC<ApisViewProps> = ({ stats, publisherId: _publisherId }) => {
  const router = useRouter();
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const gatewayBase =
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://spigot.sh');

  const handleCopy = (path: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filteredEndpoints = (stats.endpoints || []).filter(ep => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (ep.path || '').toLowerCase().includes(term) ||
      (ep.method || '').toLowerCase().includes(term) ||
      (ep.api_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-main">APIs & Monetized Endpoints</h2>
          <p className="text-sm text-muted">
            Configure pay-per-call pricing, inspect gateway routing, and deploy new endpoints to
            Algorand x402.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => router.push('/onboarding')}>
            <Plus size={16} className="mr-1.5" /> Publish New API
          </Button>
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card hoverable>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">
            Registered Endpoints
          </div>
          <div className="text-3xl font-semibold text-main">{(stats.endpoints || []).length}</div>
          <div className="text-xs text-muted mt-2">Protected by x402 reverse proxy</div>
        </Card>

        <Card hoverable>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Gateway Protocol</div>
          <div className="text-3xl font-semibold text-accent font-mono">x402 / HTTP</div>
          <div className="text-xs text-muted mt-2">
            Each call is paid on chain before it is proxied
          </div>
        </Card>

        <Card hoverable>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Settlement Token</div>
          <div className="text-3xl font-semibold text-success font-mono">USDC</div>
          <div className="text-xs text-muted mt-2">Algorand Testnet (ASA 10458941)</div>
        </Card>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Filter endpoints by path, method, or API name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-3.5 py-2 rounded-md bg-bg border border-border text-main text-sm outline-none focus:border-main"
        />
      </div>

      {/* Endpoints Table */}
      <Card padding="none" header="Active Endpoints">
        <Table>
          <thead>
            <tr>
              <Th>Method</Th>
              <Th>Endpoint Path</Th>
              <Th>x402 Gateway Proxy URL</Th>
              <Th numeric>Calls</Th>
              <Th numeric>Revenue</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filteredEndpoints.length > 0 ? (
              filteredEndpoints.map((ep: DashboardEndpointRow, i: number) => {
                const epPath = ep.path || '/';
                const epMethod = ep.method || 'GET';
                // The backend routes on `{origin}/x402/{apiSlug}{endpointPath}` and 404s unless
                // the API is PUBLISHED (Spigot-Algorand/backend/src/routes/gateway.ts:48-50).
                // Without a valid slug, or without a confirmed PUBLISHED status, there is no
                // real URL to show — leave it blank rather than build one that 404s.
                const epWithStatus = ep as EndpointRowWithStatus;
                const fullProxyUrl = buildPublishedGatewayUrl(
                  gatewayBase,
                  ep.api_slug,
                  epPath,
                  epWithStatus.api_status ?? epWithStatus.status,
                );
                const isCopied = copiedPath === epPath;

                return (
                  <tr key={i}>
                    <Td>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-panel-hover text-accent border border-border">
                        {epMethod}
                      </span>
                    </Td>
                    <Td mono className="font-medium text-main">
                      {epPath}
                    </Td>
                    <Td>
                      {fullProxyUrl ? (
                        <div className="flex items-center gap-2 max-w-md">
                          <span className="font-mono text-xs text-muted truncate">
                            {fullProxyUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(epPath, fullProxyUrl)}
                            className="p-1 rounded hover:bg-panel-hover text-muted hover:text-main cursor-pointer"
                            title="Copy Gateway URL"
                          >
                            {isCopied ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-muted">—</span>
                      )}
                    </Td>
                    <Td numeric className="font-mono">
                      {(ep.request_count || ep.requests || 0).toLocaleString()}
                    </Td>
                    <Td numeric className="font-mono text-accent font-medium">
                      ${(ep.total_revenue || ep.revenue || 0).toFixed(4)}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/test/${ep.api_slug || ep.api_name || 'active'}`)
                        }
                        className="flex items-center gap-1 text-xs text-muted hover:text-accent font-medium cursor-pointer"
                      >
                        <ExternalLink size={13} /> Test
                      </button>
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <TdEmpty colSpan={6}>
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Server size={36} className="text-muted mb-3 opacity-40" />
                    <p className="text-sm text-main font-medium mb-1">
                      {searchTerm ? 'No endpoints match your search' : 'No Endpoints Published Yet'}
                    </p>
                    <p className="text-xs text-muted max-w-sm text-center mb-5">
                      {searchTerm
                        ? 'Try modifying your search term or clear the filter.'
                        : 'Connect your OpenAPI spec or HTTP endpoint URL to start earning USDC per call.'}
                    </p>
                    {!searchTerm && (
                      <Button variant="primary" onClick={() => router.push('/onboarding')}>
                        <Plus size={15} className="mr-1.5" /> Publish Your First API
                      </Button>
                    )}
                  </div>
                </TdEmpty>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};
