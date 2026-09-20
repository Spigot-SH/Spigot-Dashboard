'use client';

import React from 'react';
import { Card } from '../common/Card';
import { DashboardStats, DashboardEndpointRow } from '../../api/client';
import { Activity, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { UNKNOWN } from '../../lib/format';

interface AnalyticsViewProps {
  stats: DashboardStats;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats }) => {
  const totalReqs = stats.requestsMonth;
  const totalRev = (stats.endpoints || []).reduce(
    (acc, ep) => acc + Number(ep.total_revenue || ep.revenue || 0),
    0,
  );
  const avgLatency = stats.health?.avgLatency || 0;
  // null until an endpoint has traffic. The rate and the latency cover every request ever made.
  const hasTraffic = stats.successRate !== null;
  const successRate = stats.successRate ?? 0;
  // No requests yet means there is no rate to report; show a dash, never a default.
  const successLabel = hasTraffic ? `${successRate}%` : UNKNOWN;

  return (
    <div className="flex flex-col gap-8">
      {/* Top Header */}
      <div>
        <div>
          <h2 className="text-2xl font-semibold text-main">API Traffic & Analytics</h2>
          <p className="text-sm text-muted">
            Inspect live request distribution, latency, and revenue settlement across your x402
            endpoints.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card hoverable className="relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs uppercase tracking-wider text-muted font-normal">
              Requests this month
            </span>
            <span className="p-1.5 rounded-md bg-accent/10 text-accent">
              <Activity size={16} />
            </span>
          </div>
          <div className="text-2xl font-semibold text-main">{totalReqs.toLocaleString()}</div>
          <div className="text-xs text-muted mt-2">Since the first of this month</div>
        </Card>

        <Card hoverable className="relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs uppercase tracking-wider text-muted font-normal">
              Earned Revenue
            </span>
            <span className="p-1.5 rounded-md bg-success/10 text-success">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="text-2xl font-semibold text-main">${totalRev.toFixed(4)}</div>
          <div className="text-xs text-muted mt-2">Sum of endpoint revenue, all requests</div>
        </Card>

        <Card hoverable className="relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs uppercase tracking-wider text-muted font-normal">
              Avg Latency
            </span>
            <span className="p-1.5 rounded-md bg-accent-dim/10 text-accent-dim">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-2xl font-semibold font-mono text-main">
            {hasTraffic ? avgLatency : UNKNOWN}
            {hasTraffic && <span className="text-sm font-normal text-muted"> ms</span>}
          </div>
          <div className="text-xs text-muted mt-2">Average over all requests</div>
        </Card>

        <Card hoverable className="relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs uppercase tracking-wider text-muted font-normal">
              Success Rate
            </span>
            <span className="p-1.5 rounded-md bg-success/10 text-success">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-semibold text-success">{successLabel}</div>
          <div className="text-xs text-muted mt-2">Responses below HTTP 400, all requests</div>
        </Card>
      </div>

      {/* HTTP Status Breakdown */}
      <Card header="Response Health & Status Codes">
        <div className="flex flex-col gap-4 py-2">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-main font-medium flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-success inline-block"></span>
                Success (below HTTP 400)
              </span>
              <span className="font-mono text-success font-medium">{successLabel}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-panel overflow-hidden border border-border">
              <div
                className="h-full bg-success"
                style={{ width: `${hasTraffic ? successRate : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-main font-medium flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block"></span>
                Errors (4xx and 5xx)
              </span>
              <span className="font-mono text-warning font-medium">
                {hasTraffic ? `${(100 - successRate).toFixed(1)}%` : UNKNOWN}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-panel overflow-hidden border border-border">
              <div
                className="h-full bg-warning"
                style={{ width: `${hasTraffic ? Math.min(100 - successRate, 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Latency Breakdown & Endpoint Rankings */}
      <Card header="Endpoint Performance Breakdown">
        {stats.endpoints && stats.endpoints.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2.5 px-3">Path</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Calls</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {stats.endpoints.map((ep: DashboardEndpointRow, idx: number) => {
                  const calls = Number(ep.request_count ?? ep.requests ?? 0);
                  const rev = Number(ep.total_revenue ?? ep.revenue ?? 0);
                  const lat = Number(ep.avg_latency ?? ep.latency ?? 0);
                  return (
                    <tr key={idx} className="border-b border-border/50 hover:bg-panel-hover">
                      <td className="py-3 px-3 font-mono text-main">{ep.path || '/'}</td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-panel-hover text-main font-mono border border-border">
                          {ep.method || 'GET'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-main">
                        {calls.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-accent font-medium">
                        ${rev.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted">
                        {Math.round(lat)}ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted">
            No endpoints registered yet. Published APIs will rank here by call frequency and
            earnings.
          </div>
        )}
      </Card>
    </div>
  );
};
