'use client';

import type { OnboardingData } from '../../types/onboarding';
import { errorMessage as toMessage } from '../../lib/errors';
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/client';
import { Copy, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface DomainVerifyProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DomainVerify: React.FC<DomainVerifyProps> = ({ data, updateData, onNext, onBack }) => {
  const [challenge, setChallenge] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'VERIFIED' | 'FAILED'>(
    data.domainVerified ? 'VERIFIED' : 'IDLE',
  );
  const [errorMessage, setErrorMessage] = useState('');

  const [verificationId, setVerificationId] = useState<string>('');

  const domain = data.domain || 'example.com';

  const initiateVerification = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.initiateVerification(domain);
      setChallenge(res.challenge);
      setVerificationId(res.id);
      setStatus('PENDING');
      setLoading(false);
    } catch (err) {
      setErrorMessage(toMessage(err, 'Failed to initiate verification'));
      setLoading(false);
    }
  }, [domain]);

  // Declared above the effect on purpose: reading it beforehand relies on the effect running
  // after the whole component body has evaluated, which is true but fragile to reorder.
  useEffect(() => {
    if (status === 'IDLE' && domain) {
      void initiateVerification();
    }
    // Runs once on mount — re-requesting a challenge on every status change would invalidate
    // the TXT record the user is in the middle of publishing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkVerification = async () => {
    try {
      setVerifying(true);
      setErrorMessage('');

      const res = await apiClient.checkVerification(verificationId);

      if (res.status === 'VERIFIED') {
        setStatus('VERIFIED');
        updateData({ domainVerified: true });
      } else {
        setStatus('FAILED');
        setErrorMessage('Verification not completed yet. Please try again.');
      }
      setVerifying(false);
    } catch (err) {
      setStatus('FAILED');
      setErrorMessage(toMessage(err, 'Verification failed. Please ensure the file is accessible.'));
      setVerifying(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(challenge);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="Domain Ownership Verification" padding="lg">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <div className="text-sm text-muted mb-1">Target Domain</div>
              <div className="font-mono text-lg">{domain}</div>
            </div>
            <StatusBadge
              status={
                status === 'VERIFIED' ? 'ONLINE' : status === 'FAILED' ? 'OFFLINE' : 'PENDING'
              }
              className="px-3 py-1"
            />
          </div>

          {status !== 'VERIFIED' ? (
            <>
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                <h4 className="flex items-center gap-2 text-accent-dim mb-2">
                  <AlertTriangle size={18} /> Instructions
                </h4>
                <p className="text-sm text-muted mb-4">
                  To verify you own this domain, serve the following challenge code at the exact URL
                  path below. The file must be accessible publicly without authentication.
                </p>

                <div className="mb-2 text-sm text-main font-medium">
                  Create a file at this path:
                </div>
                <pre className="mb-4">
                  <code>
                    https://{domain.replace(/^https?:\/\//, '').split('/')[0]}
                    /.well-known/x402/verify
                  </code>
                </pre>

                <div className="mb-2 text-sm text-main font-medium">With this exact content:</div>
                <div className="relative">
                  <pre>
                    <code>{challenge || 'Generating challenge...'}</code>
                  </pre>
                  {challenge && (
                    <button
                      onClick={copyToClipboard}
                      className="absolute right-2 top-2 p-1.5 bg-panel rounded hover:bg-[var(--bg-panel-hover)] text-muted"
                      title="Copy to clipboard"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20">
                  {errorMessage}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-accent/5 border border-accent/20 rounded-lg">
              <CheckCircle size={48} className="text-accent mb-4" />
              <h3 className="text-xl font-medium mb-2">Domain Verified Successfully</h3>
              <p className="text-muted">
                You have proven ownership of {domain}. You can now proceed to configure your API.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-4">
          {status !== 'VERIFIED' && (
            <Button
              variant="secondary"
              onClick={checkVerification}
              disabled={!challenge || verifying || loading}
              isLoading={verifying}
            >
              <RefreshCw size={16} className={verifying ? '' : ''} />
              Check Verification
            </Button>
          )}
          <Button variant="primary" onClick={onNext} disabled={status !== 'VERIFIED'}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DomainVerify;
