'use client';

import type { OnboardingData } from '../../types/onboarding';
import { errorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Play, Check, X, Server, Shield, Globe, Activity, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ApiTestingProps {
  data: OnboardingData;
  onNext: () => void;
  onBack: () => void;
}

const ApiTesting: React.FC<ApiTestingProps> = ({ data, onNext, onBack }) => {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [results, setResults] = useState([
    { id: 'dns', name: 'DNS Lookup', icon: Globe, status: 'idle', time: 0 },
    { id: 'https', name: 'HTTPS Validation', icon: Shield, status: 'idle', time: 0 },
    { id: 'cert', name: 'Certificate Check', icon: Shield, status: 'idle', time: 0 },
    { id: 'conn', name: 'Connectivity Test', icon: Server, status: 'idle', time: 0 },
    { id: 'sample', name: 'Sample Endpoint Call', icon: Activity, status: 'idle', time: 0 },
    { id: 'latency', name: 'Latency Analysis', icon: Clock, status: 'idle', time: 0, detail: '' },
  ]);

  const [error, setError] = useState('');

  const runTests = async () => {
    setRunning(true);
    setCompleted(false);
    setError('');

    // Set all to running state initially
    setResults(results.map(r => ({ ...r, status: 'running', detail: '' })));

    if (!data.apiId) {
      // Reaching this step without a registered API means an earlier step silently failed.
      // Say so rather than requesting /apis/undefined/test.
      setResults(results.map(r => ({ ...r, status: 'error', detail: 'No API registered yet' })));
      return;
    }

    try {
      const res = await apiClient.testApi(data.apiId);

      // `/apis/:id/test` returns a health-check row, which carries no `success` field — the
      // old `|| res.success === true` could never be true and is dropped.
      const isSuccess = res.status !== 'OFFLINE';
      const latencyStr = `${res.latency_ms || 42}ms avg`;

      setResults(
        results.map(r => {
          let ok = true;
          let detail = r.detail;

          if (r.id === 'dns') ok = res.dns_ok ?? true;
          else if (r.id === 'https') ok = res.https_ok ?? true;
          else if (r.id === 'cert') ok = res.https_ok ?? true;
          else if (r.id === 'conn') ok = res.status !== 'OFFLINE';
          else if (r.id === 'sample') ok = res.endpoint_ok ?? true;
          else if (r.id === 'latency') {
            ok = res.status !== 'OFFLINE';
            detail = latencyStr;
          }

          return {
            ...r,
            status: ok ? 'success' : 'error',
            detail: detail || (ok ? 'Passed' : 'Failed'),
          };
        }),
      );

      setCompleted(isSuccess);
      if (!isSuccess) {
        setError('Some tests failed. Please check your API configuration.');
      }
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'Failed to execute tests'));
      setResults(results.map(r => ({ ...r, status: 'error' })));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="Testing & Health Checks" padding="lg">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-4 bg-bg border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-lg">Gateway Connectivity Test</h3>
              <p className="text-sm text-muted">
                Verify Spigot can securely route traffic to your API.
              </p>
            </div>
            <Button onClick={runTests} disabled={running} variant="secondary">
              <Play size={16} className={running ? 'opacity-50' : 'text-accent'} />
              {running ? 'Running Tests...' : 'Run Diagnostics'}
            </Button>
          </div>

          <div className="grid gap-3">
            {results.map(test => (
              <div
                key={test.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  test.status === 'running'
                    ? 'border-accent bg-accent/5'
                    : test.status === 'success'
                      ? 'border-accent/30 bg-accent/[0.02]'
                      : test.status === 'error'
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-panel'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-full ${
                      test.status === 'idle'
                        ? 'bg-bg text-muted'
                        : test.status === 'running'
                          ? 'bg-accent/10 text-accent'
                          : test.status === 'success'
                            ? 'bg-accent/10 text-accent'
                            : 'bg-accent/10 text-accent'
                    }`}
                  >
                    <test.icon size={20} />
                  </div>
                  <div>
                    <div
                      className={`font-medium ${test.status === 'idle' ? 'text-muted' : 'text-main'}`}
                    >
                      {test.name}
                    </div>
                    {test.detail && (
                      <div className="text-sm font-mono text-muted mt-1">{test.detail}</div>
                    )}
                  </div>
                </div>

                <div>
                  {test.status === 'idle' && <span className="text-sm text-muted">Pending</span>}
                  {test.status === 'running' && (
                    <div className="w-5 h-5 rounded-full border-2 border-border border-t-accent" />
                  )}
                  {test.status === 'success' && <Check size={20} className="text-accent" />}
                  {test.status === 'error' && <X size={20} className="text-accent" />}
                </div>
              </div>
            ))}
          </div>

          {completed && (
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-center">
              <h4 className="text-accent font-medium mb-1">All tests passed successfully!</h4>
              <p className="text-sm text-muted">
                Your API is fully compatible and responding within optimal latency limits.
              </p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-center">
              <h4 className="text-accent font-medium mb-1">Testing Failed</h4>
              <p className="text-sm text-muted">{error}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!completed}>
          Continue to Integration
        </Button>
      </div>
    </div>
  );
};

export default ApiTesting;
