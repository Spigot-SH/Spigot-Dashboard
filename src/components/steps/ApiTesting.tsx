'use client';

import type { OnboardingData } from '../../types/onboarding';
import type { HealthReport } from '../../api/client';
import { errorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Play, Check, X, Shield, Activity, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ApiTestingProps {
  data: OnboardingData;
  onNext: () => void;
  onBack: () => void;
}

/**
 * What `POST /apis/:id/test` measures, and nothing else.
 *
 * The step used to list six named checks: DNS Lookup, HTTPS Validation, Certificate Check,
 * Connectivity Test, Sample Endpoint Call and Latency Analysis. Three of those were not
 * measurements. `dns_ok`, `auth_ok` and `schema_ok` are written as literal `true` by
 * `Spigot-Algorand/backend/src/services/health.ts:115`, the certificate row read `https_ok`
 * a second time, and each row fell back to `?? true`, so a response that omitted a field
 * printed "Passed". Latency printed `res.latency_ms || 42`, inventing 42 ms.
 *
 * Three fields carry a real measurement, so there are three rows.
 */
const rowsFrom = (res: HealthReport) => [
  {
    id: 'https',
    name: 'Served over HTTPS',
    icon: Shield,
    ok: res.https_ok === true,
    detail: res.https_ok ? 'The base URL uses https.' : 'The base URL is not https.',
  },
  {
    id: 'endpoint',
    name: 'Base URL answered',
    icon: Activity,
    ok: res.endpoint_ok === true,
    detail: res.endpoint_ok ? 'Your server responded.' : 'Your server did not respond.',
  },
  {
    id: 'latency',
    name: 'Round trip',
    icon: Clock,
    ok: res.status !== 'OFFLINE',
    // No measurement is a dash. A default here would report a speed nobody timed.
    detail: typeof res.latency_ms === 'number' ? `${res.latency_ms}ms` : '-',
  },
];

type Row = ReturnType<typeof rowsFrom>[number];

const ApiTesting: React.FC<ApiTestingProps> = ({ data, onNext, onBack }) => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState('');

  const runTests = async () => {
    setRunning(true);
    setReport(null);
    setError('');

    if (!data.apiId) {
      // Reaching this step without a registered API means an earlier step silently failed.
      // Say so rather than requesting /apis/undefined/test.
      setError('No API is registered yet. Go back to API Configuration and save it first.');
      setRunning(false);
      return;
    }

    try {
      const res = await apiClient.testApi(data.apiId);
      setReport(res);
      if (res.status === 'OFFLINE') {
        setError(res.error_message || 'Spigot could not reach your API.');
      }
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'Failed to run the check'));
    } finally {
      setRunning(false);
    }
  };

  const rows: Row[] = report ? rowsFrom(report) : [];
  const reachable = report !== null && report.status !== 'OFFLINE';

  return (
    <div className="flex flex-col gap-6">
      <Card header="Testing & Health Checks" padding="lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-bg border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-lg">Gateway connectivity check</h3>
              <p className="text-sm text-muted">
                Spigot requests your base URL once and reports what came back.
              </p>
            </div>
            <Button onClick={runTests} disabled={running} variant="secondary">
              <Play size={16} className={running ? 'opacity-50' : 'text-accent'} />
              {running ? 'Checking...' : report ? 'Check again' : 'Run check'}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="grid gap-3">
              {rows.map(row => (
                <div
                  key={row.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    row.ok ? 'border-accent/30 bg-accent/[0.02]' : 'border-accent bg-accent/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-accent/10 text-accent">
                      <row.icon size={20} />
                    </div>
                    <div>
                      <div className="font-medium text-main">{row.name}</div>
                      <div className="text-sm font-mono text-muted mt-1">{row.detail}</div>
                    </div>
                  </div>
                  <div>
                    {row.ok ? (
                      <Check size={20} className="text-accent" />
                    ) : (
                      <X size={20} className="text-accent" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {report && (
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-center">
              <h4 className="text-accent font-medium mb-1">
                {report.status === 'ONLINE'
                  ? 'Your API answered'
                  : report.status === 'DEGRADED'
                    ? 'Your API answered with an error'
                    : 'Spigot could not reach your API'}
              </h4>
              <p className="text-sm text-muted">
                This is one request to your base URL. It does not test your endpoints, your
                credentials or your response format.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-center">
              <h4 className="text-accent font-medium mb-1">Check failed</h4>
              <p className="text-sm text-muted">{error}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!reachable}>
          Continue to Integration
        </Button>
      </div>
    </div>
  );
};

export default ApiTesting;
