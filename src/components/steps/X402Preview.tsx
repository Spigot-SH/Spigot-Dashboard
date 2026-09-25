'use client';

import type { OnboardingData } from '../../types/onboarding';
import React, { useEffect, useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ArrowRight, DollarSign, Globe, Server } from 'lucide-react';
import { ApiEndpoint } from '../../api/client';
import { Table, Th, Td } from '../common/Table';
import { normalizeEndpointPath } from '../../lib/gatewayUrl';

interface X402PreviewProps {
  data: OnboardingData;
  onNext: () => void;
  onBack: () => void;
}

const CONFIGURED_GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL;

const X402Preview: React.FC<X402PreviewProps> = ({ data, onNext, onBack }) => {
  const endpoints: ApiEndpoint[] = data.endpoints?.length
    ? data.endpoints
    : [{ method: 'GET', path: '/example', name: 'Example', description: 'Example endpoint' }];
  // The real slug the backend issued in ApiInfo.tsx (`POST /api/apis` response). It includes a
  // random 5-char suffix the client cannot reproduce, so this must never be recomputed here.
  const apiIdSlug = data.apiSlug;

  // The gateway is served from this origin, so no extra configuration is needed. Resolved in
  // an effect because this component is server-rendered first, where `window` does not exist —
  // reading it during render would crash the build, and a `typeof window` guard would render
  // one value on the server and another on the client, tripping hydration.
  const [gatewayDomain, setGatewayDomain] = useState(CONFIGURED_GATEWAY || '');

  useEffect(() => {
    if (!CONFIGURED_GATEWAY) setGatewayDomain(window.location.origin);
  }, []);

  const sampleEndpoint = endpoints[0];

  return (
    <div className="flex flex-col gap-6">
      <Card header="x402 Protocol Integration Preview" padding="lg">
        <div className="flex flex-col gap-8">
          <div>
            <h4 className="mb-4 text-accent">Endpoint Mapping</h4>
            <Table className="rounded-lg border border-border bg-panel">
              <thead>
                <tr>
                  <Th>Original Endpoint</Th>
                  <Th>
                    <ArrowRight size={16} className="mx-auto text-muted" aria-hidden="true" />
                  </Th>
                  <Th>Spigot Gateway URL</Th>
                </tr>
              </thead>
              <tbody>
                {endpoints.slice(0, 3).map((ep, i) => (
                  <tr key={i}>
                    <Td mono className="text-muted">
                      <span className="text-xs mr-2">{ep.method}</span>
                      {data.baseUrl || 'https://api.example.com'}
                      {ep.path}
                    </Td>
                    <Td className="text-center">
                      <ArrowRight size={16} className="text-muted" aria-hidden="true" />
                    </Td>
                    <Td mono className="text-accent">
                      {apiIdSlug ? (
                        <>
                          <span className="text-xs mr-2">{ep.method}</span>
                          {gatewayDomain}/x402/{apiIdSlug}
                          {normalizeEndpointPath(ep.path)}
                        </>
                      ) : (
                        <span className="text-muted">
                          Gateway URL appears after the API is registered
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
                {endpoints.length > 3 && (
                  <tr>
                    <td colSpan={3} className="text-center text-xs text-muted py-2">
                      + {endpoints.length - 3} more endpoints mapped
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          <div>
            <h4 className="mb-4 text-accent">Consumer Usage Example</h4>
            <p className="text-sm text-muted mb-2">
              Consumers will call your API through the gateway, providing an L2 payment signature in
              the headers.
            </p>
            {apiIdSlug ? (
              <pre>
                <code>
                  <span className="text-muted">curl</span> -X {sampleEndpoint.method}{' '}
                  {gatewayDomain}
                  /x402/{apiIdSlug}
                  {normalizeEndpointPath(sampleEndpoint.path)} \ -H{' '}
                  <span className="text-accent-dim">
                    &quot;Content-Type: application/json&quot;
                  </span>{' '}
                  \ -H{' '}
                  <span className="text-accent-dim">
                    &quot;x-x402-payment-signature: 0x7a8b...9c0d&quot;
                  </span>
                </code>
              </pre>
            ) : (
              <p className="text-sm text-muted">
                This example fills in once your API is registered.
              </p>
            )}
          </div>

          <div>
            <h4 className="mb-4 text-accent">Payment & Execution Flow</h4>
            <div className="flex items-center justify-between bg-bg p-6 rounded-lg border border-border">
              <div className="flex flex-col items-center gap-2 text-center w-1/4">
                <div className="w-12 h-12 rounded-full bg-panel border border-border flex items-center justify-center">
                  <Globe size={20} className="text-muted" />
                </div>
                <span className="text-sm font-medium">Consumer App</span>
                <span className="text-xs text-muted font-mono">Sends Req + Tx</span>
              </div>

              <div className="flex-1 border-t-2 border-dashed border-border relative">
                <ArrowRight size={16} className="absolute right-0 top-[-9px] text-border" />
              </div>

              <div className="flex flex-col items-center gap-2 text-center w-1/4">
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <DollarSign size={20} className="text-accent-dim" />
                </div>
                <span className="text-sm font-medium">Spigot Gateway</span>
                <span className="text-xs text-muted font-mono">Verifies Payment</span>
              </div>

              <div className="flex-1 border-t-2 border-dashed border-accent relative">
                <ArrowRight size={16} className="absolute right-0 top-[-9px] text-accent" />
              </div>

              <div className="flex flex-col items-center gap-2 text-center w-1/4">
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <Server size={20} className="text-accent" />
                </div>
                <span className="text-sm font-medium">Your Backend</span>
                <span className="text-xs text-muted font-mono">Processes Request</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Continue to Review
        </Button>
      </div>
    </div>
  );
};
export default X402Preview;
