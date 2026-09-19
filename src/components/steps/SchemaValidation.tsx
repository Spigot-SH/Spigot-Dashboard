'use client';

import type { OnboardingData } from '../../types/onboarding';
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Check, RefreshCw } from 'lucide-react';
import { ApiEndpoint } from '../../api/client';
import { Progress } from '../common/Progress';

interface SchemaValidationProps {
  data: OnboardingData;
  onNext: () => void;
  onBack: () => void;
}

const SchemaValidation: React.FC<SchemaValidationProps> = ({ data, onNext, onBack }) => {
  const [validating, setValidating] = useState(true);
  // `|| []` allocates a fresh array on every render, which would retrigger the effect below
  // on every render. Memoising keeps the identity stable until `data.endpoints` itself changes.
  const endpoints = useMemo<ApiEndpoint[]>(() => data.endpoints || [], [data.endpoints]);

  useEffect(() => {
    // Simulate validation process
    setValidating(true);
    const timer = setTimeout(() => {
      setValidating(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [endpoints]);

  const checks = ['Valid JSON', 'Required fields', 'Data types', 'Nested objects', 'Arrays'];

  return (
    <div className="flex flex-col gap-6">
      <Card header="Schema Validation" padding="lg">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg">Endpoints Overview</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setValidating(true)}
              disabled={validating}
              isLoading={validating}
            >
              <RefreshCw size={14} />
              {validating ? 'Validating...' : 'Re-validate'}
            </Button>
          </div>

          {/* `progress-bar-container` and `progress-bar-fill` were defined nowhere, so this
              rendered as an empty box. Validation has no per-endpoint progress to report, so
              the wait lives on the button and the bar only states the settled result. */}
          {!validating && (
            <Progress
              value={endpoints.length}
              max={endpoints.length || 1}
              tone="success"
              label="Endpoints validated"
            />
          )}

          {!validating && (
            <p className="text-sm font-medium text-accent">
              {endpoints.length} of {endpoints.length} endpoints successfully validated.
            </p>
          )}

          <div className="flex flex-col gap-4 mt-2">
            {endpoints.map((ep, idx) => (
              <div key={idx} className="bg-bg border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-panel px-2 py-1 rounded">
                      {ep.method}
                    </span>
                    <span className="font-mono text-sm">{ep.path}</span>
                  </div>
                  {validating ? (
                    <RefreshCw size={16} className="text-accent-dim" />
                  ) : (
                    <span className="text-accent flex items-center gap-1 text-sm font-medium">
                      <Check size={16} /> Passed
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  {checks.map((check, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2 text-sm text-muted">
                      {validating ? (
                        <div className="w-4 h-4 rounded-full border-2 border-border border-t-accent-dim" />
                      ) : (
                        <Check size={14} className="text-accent" />
                      )}
                      {check}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {endpoints.length === 0 && (
              <p className="text-center text-muted py-8">No endpoints to validate.</p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={validating || endpoints.length === 0}>
          Continue to Categories
        </Button>
      </div>
    </div>
  );
};

export default SchemaValidation;
