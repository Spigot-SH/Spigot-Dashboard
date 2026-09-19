'use client';

import type { OnboardingData } from '../../types/onboarding';
import { errorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { truncateMiddle } from '../../lib/format';

interface PublishProps {
  data: OnboardingData;
  onBack: () => void;
  onPublish: () => void;
}

const Publish: React.FC<PublishProps> = ({ data, onBack, onPublish }) => {
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);

  const steps = [
    { name: 'Publisher Details Provided', valid: !!data.publisherName && !!data.email },
    { name: 'Domain Verified', valid: data.domainVerified },
    { name: 'API Configured', valid: !!data.apiName && !!data.baseUrl },
    { name: 'Endpoints Imported', valid: data.endpoints && data.endpoints.length > 0 },
    { name: 'Skills Selected', valid: data.skills && data.skills.length > 0 },
    { name: 'Pricing Configured', valid: !!data.settlementAddress },
  ];

  const allReady = steps.every(s => s.valid);

  const [error, setError] = useState('');

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      if (data.skills && data.skills.length > 0 && data.apiId) {
        for (const skill of data.skills) {
          await apiClient.addSkill(data.apiId, skill);
        }
      }

      if (!data.apiId) {
        throw new Error('No API to publish — the API configuration step did not complete.');
      }
      await apiClient.publishApi(data.apiId);

      setSuccess(true);
      setTimeout(() => {
        onPublish();
      }, 2000);
    } catch (err) {
      setError(errorMessage(err, 'Failed to publish API'));
    } finally {
      setPublishing(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="absolute inset-0 bg-accent blur-[40px] opacity-30 rounded-full"></div>
          <CheckCircle size={80} className="text-accent relative z-10" />
        </div>
        <h2 className="text-3xl mt-8 mb-2 text-accent">API Published Successfully!</h2>
        <p className="text-muted text-lg text-center max-w-md">
          Your API is now live on the Spigot marketplace. Redirecting you to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card header="Review & Publish" padding="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <h4 className="mb-4">Readiness Checklist</h4>
            <div className="flex flex-col gap-3 bg-bg p-4 rounded-lg border border-border">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.valid ? (
                    <CheckCircle size={18} className="text-accent" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-accent flex items-center justify-center text-[10px] text-accent">
                      X
                    </div>
                  )}
                  <span className={step.valid ? 'text-main' : 'text-accent'}>{step.name}</span>
                </div>
              ))}
            </div>

            {!allReady && (
              <div className="mt-4 p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20">
                Please complete all previous steps before publishing.
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-4">Configuration Summary</h4>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">API Name</span>
                <span className="font-medium">{data.apiName || 'Not set'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">Base URL</span>
                <span className="font-medium font-mono text-sm">{data.baseUrl || 'Not set'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">Total Endpoints</span>
                <span className="font-medium">{data.endpoints?.length || 0}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">Pricing Model</span>
                <span className="font-medium">
                  {data.pricingModel === 'Subscription' ? 'Subscription' : 'Pay Per Use'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">Settlement Wallet</span>
                <span className="font-medium font-mono text-xs">
                  {data.settlementAddress
                    ? truncateMiddle(data.settlementAddress, 8, 6)
                    : 'Not set'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20 mt-4">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack} disabled={publishing}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handlePublish}
          disabled={!allReady || publishing}
          isLoading={publishing}
          className="px-10 text-lg shadow-[0_0_20px_var(--color-accent)]"
        >
          {publishing ? 'Publishing...' : 'Publish to Marketplace'}
        </Button>
      </div>
    </div>
  );
};

export default Publish;
