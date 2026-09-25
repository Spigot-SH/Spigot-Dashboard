'use client';

import type { OnboardingData } from '../../types/onboarding';
import type { InitiationState } from '../../lib/domainVerification';
import { errorMessage as toMessage } from '../../lib/errors';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/client';
import {
  validateChallengeResponse,
  initialInitiationState,
  startInitiation,
  applyInitiationOutcome,
} from '../../lib/domainVerification';
import { Copy, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface DomainVerifyProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DomainVerify: React.FC<DomainVerifyProps> = ({ data, updateData, onNext, onBack }) => {
  // Everything about the current /verify/initiate attempt — challenge, record name, phase and
  // its own error — lives in one object so the pure applyInitiationOutcome reducer can tell a
  // stale response (from a superseded request) apart from the one the UI is waiting for. See
  // src/lib/domainVerification.ts for the state machine itself.
  const initiationRef = useRef<InitiationState>(initialInitiationState());
  const [initiation, setInitiationState] = useState<InitiationState>(initialInitiationState());
  const setInitiation = useCallback((next: InitiationState) => {
    initiationRef.current = next;
    setInitiationState(next);
  }, []);

  const [verifying, setVerifying] = useState<boolean>(false);
  const [status, setStatus] = useState<'PENDING' | 'VERIFIED' | 'FAILED'>(
    data.domainVerified ? 'VERIFIED' : 'PENDING',
  );
  const [checkError, setCheckError] = useState('');

  const domain = data.domain || 'example.com';

  const initiateVerification = useCallback(async () => {
    const started = startInitiation(initiationRef.current);
    setInitiation(started);
    const requestId = started.requestId;
    try {
      const res = await apiClient.initiateVerification(domain);
      // A partial or malformed response must never show DNS instructions or enter PENDING —
      // never fall back to the raw domain as the record name, never accept a TXT record for a
      // different host, and never accept a value that is not exactly the backend's challenge
      // (see DECISIONS.md and src/lib/domainVerification.ts).
      const check = validateChallengeResponse(res, domain);
      if (!check.ok) {
        setInitiation(
          applyInitiationOutcome(initiationRef.current, requestId, {
            ok: false,
            error: check.error,
          }),
        );
        return;
      }
      setInitiation(
        applyInitiationOutcome(initiationRef.current, requestId, {
          ok: true,
          challenge: res.record.value,
          recordName: res.record.name,
          verificationId: res.id,
        }),
      );
    } catch (err) {
      setInitiation(
        applyInitiationOutcome(initiationRef.current, requestId, {
          ok: false,
          error: toMessage(err, 'Failed to initiate verification'),
        }),
      );
    }
  }, [domain, setInitiation]);

  // Declared above the effect on purpose: reading it beforehand relies on the effect running
  // after the whole component body has evaluated, which is true but fragile to reorder.
  useEffect(() => {
    if (status !== 'VERIFIED' && domain) {
      void initiateVerification();
    }
    // Runs once on mount — re-requesting a challenge on every status change would invalidate
    // the TXT record the user is in the middle of publishing. A later attempt (a 410, or the
    // user pressing Retry) calls initiateVerification directly, not through this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkVerification = async () => {
    try {
      setVerifying(true);
      setCheckError('');

      const res = await apiClient.checkVerification(initiation.verificationId);

      if (res.status === 'VERIFIED') {
        setStatus('VERIFIED');
        updateData({ domainVerified: true });
      } else if (res.status === 'EXPIRED') {
        // The backend expires a challenge 30 minutes after /verify/initiate (410). Re-initiate
        // to get a fresh id, challenge and record — the publisher must update the TXT record
        // to the new value, the old one no longer verifies anything. If this re-initiate itself
        // fails or times out, initiateVerification's ERROR phase shows a Retry button, so the
        // wizard never dead-ends on a disabled Check button with no way forward.
        setCheckError(
          'This verification challenge expired after 30 minutes. Requesting a new one — ' +
            'update your DNS TXT record with the new value below, then check again.',
        );
        void initiateVerification();
      } else {
        setStatus('FAILED');
        setCheckError(res.error || 'Verification not completed yet. Please try again.');
      }
    } catch (err) {
      setStatus('FAILED');
      setCheckError(
        toMessage(err, 'Verification failed. Please ensure the DNS TXT record is published.'),
      );
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(initiation.challenge);
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
              {initiation.phase === 'READY' && (
                <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <h4 className="flex items-center gap-2 text-accent-dim mb-2">
                    <AlertTriangle size={18} /> Instructions
                  </h4>
                  <p className="text-sm text-muted mb-4">
                    To verify you own this domain, add the following DNS TXT record with your domain
                    registrar or DNS provider. DNS changes can take a few minutes to propagate — if
                    the check below fails right away, wait a bit and try again.
                  </p>

                  <div className="mb-2 text-sm text-main font-medium">Record type: TXT</div>

                  <div className="mb-2 text-sm text-main font-medium">Host / name:</div>
                  <pre className="mb-4">
                    {/* Only rendered once the response has passed validateChallengeResponse, so
                        this is always a bare hostname matching the domain that was requested —
                        never the raw domain typed in, never another host's record. */}
                    <code>{initiation.recordName}</code>
                  </pre>

                  <div className="mb-2 text-sm text-main font-medium">Value:</div>
                  <div className="relative">
                    <pre>
                      <code>{initiation.challenge}</code>
                    </pre>
                    <button
                      onClick={copyToClipboard}
                      className="absolute right-2 top-2 p-1.5 bg-panel rounded hover:bg-[var(--bg-panel-hover)] text-muted"
                      title="Copy to clipboard"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              {initiation.phase === 'LOADING' && (
                <div className="p-4 bg-bg border border-border rounded-lg text-sm text-muted">
                  Generating your verification challenge…
                </div>
              )}

              {initiation.phase === 'ERROR' && (
                <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <h4 className="flex items-center gap-2 text-accent-dim mb-2">
                    <AlertTriangle size={18} /> Could not start verification
                  </h4>
                  <p className="text-sm text-muted mb-4">{initiation.errorMessage}</p>
                  <Button variant="secondary" onClick={() => void initiateVerification()}>
                    <RefreshCw size={16} />
                    Retry
                  </Button>
                </div>
              )}

              {checkError && (
                <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20">
                  {checkError}
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
              disabled={initiation.phase !== 'READY' || verifying}
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
