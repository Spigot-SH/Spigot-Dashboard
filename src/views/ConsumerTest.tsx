'use client';

import { apiErrorMessage } from '../lib/errors';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { CheckCircle, AlertCircle, Zap, ExternalLink, Fuel } from 'lucide-react';
import { authApi, ConsumeResult, Quote } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/common/Spinner';

interface ApiDetail {
  api: { id: string; name: string; slug: string; base_url: string; version: string };
  endpoints: { id: string; name: string; method: string; path: string; description: string }[];
}

type CallState = 'idle' | 'paying' | 'success' | 'error';

interface ConsumerTestProps {
  /** Supplied by the route segment, which reads the param server-side and passes it down. */
  apiSlug: string;
}

const ConsumerTest: React.FC<ConsumerTestProps> = ({ apiSlug }) => {
  const { signedIn, openSignIn, credits, refresh } = useAuth();

  const [apiInfo, setApiInfo] = useState<ApiDetail | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [result, setResult] = useState<ConsumeResult | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!apiSlug) return;
      try {
        const apis = await (await fetch('/api/apis')).json();
        const decoded = decodeURIComponent(apiSlug).trim().toLowerCase();
        const match = apis.find(
          (a: { id?: string; slug?: string; name?: string }) =>
            (a.slug && a.slug.toLowerCase() === decoded) ||
            (a.name && a.name.toLowerCase() === decoded) ||
            a.id === apiSlug ||
            a.slug === apiSlug,
        );
        if (match) {
          const detail: ApiDetail = await (await fetch(`/api/apis/${match.id}`)).json();
          setApiInfo(detail);
          if (detail.endpoints?.length) setSelectedEndpointId(detail.endpoints[0].id);
        }
      } catch (err) {
        console.error('Failed to load API info:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [apiSlug]);

  const loadQuote = useCallback(async () => {
    const effectiveSlug = apiInfo?.api?.slug || apiSlug;
    if (!effectiveSlug || !signedIn) return;
    try {
      setQuote(await authApi.quote(effectiveSlug));
    } catch {
      setQuote(null);
    }
  }, [apiInfo?.api?.slug, apiSlug, signedIn]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote, credits]);

  const handleCall = async () => {
    const effectiveSlug = apiInfo?.api?.slug || apiSlug;
    if (!effectiveSlug || !selectedEndpointId) return;
    setState('paying');
    setError(null);
    setResult(null);

    try {
      /**
       * No `chain`. The caller does not choose where a call settles, and sending one was not
       * only jargon on the screen: `backend/src/routes/consume.ts:130` gives an explicit body
       * param priority over the publisher's own payout wallet, so a picker defaulted to
       * "Algorand" silently overrode where the publisher had asked to be paid.
       */
      const response = await authApi.consume(effectiveSlug, {
        endpointId: selectedEndpointId,
      });
      setResult(response);
      setState(response.ok ? 'success' : 'error');
      if (!response.ok) setError(`Upstream returned ${response.status}`);
      void refresh();
      void loadQuote();
    } catch (err) {
      setError(apiErrorMessage(err, 'The call failed'));
      setState('error');
      void refresh();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size={32} className="text-main" />
      </div>
    );
  }

  if (!apiInfo) {
    return (
      <div className="max-w-[900px] mx-auto p-8">
        <Card className="text-center p-8">
          <h2 className="text-xl mb-2 text-main">API Not Found</h2>
          <p className="text-muted text-sm mb-4">
            Could not find an API matching <code className="font-mono text-main">{apiSlug}</code>.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-panel border border-border hover:border-main rounded-md text-sm text-main transition-colors"
          >
            Go to the console
          </Link>
        </Card>
      </div>
    );
  }

  const selectedEndpoint = apiInfo.endpoints.find(e => e.id === selectedEndpointId);
  const hasCredit = (quote?.balance ?? 0) > 0;
  const canPay = quote?.canPay ?? false;

  return (
    <div className="max-w-[900px] mx-auto p-8">
      <h1 className="text-3xl mb-2 text-main">Test a paid API</h1>
      <p className="text-muted mb-8">
        One click calls the endpoint and spends your credit. There is no wallet popup and no fee to
        cover: the call is paid from the balance you already hold.
      </p>

      {!signedIn ? (
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base mb-1 text-main">Sign in to run a paid call</h3>
              <p className="text-muted text-sm m-0">
                Buy credit once, then call any API here without touching a wallet again.
              </p>
            </div>
            <Button variant="primary" onClick={openSignIn}>
              Sign in
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full ${hasCredit ? 'bg-success' : 'bg-warning'}`}
              />
              <div>
                <span className="text-sm font-medium text-main">
                  {hasCredit ? 'Ready to call' : 'No credit yet'}
                </span>
                <p className="text-xs text-muted m-0">
                  {quote?.callsAffordable
                    ? `${quote.callsAffordable} calls affordable`
                    : 'Top up on your Account page'}
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted">Balance </span>
                <span className="font-mono text-main">${(quote?.balance ?? 0).toFixed(2)}</span>
              </div>
              {quote?.pricePerRequest != null && (
                <div>
                  <span className="text-muted">Price </span>
                  <span className="font-mono text-main">
                    {quote.pricePerRequest} {quote.currency}/call
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {apiInfo && (
        <Card className="mb-6">
          <h2 className="text-xl mb-2 text-main">{apiInfo.api.name}</h2>
          <p className="text-muted font-mono text-xs m-0">
            {apiInfo.api.slug} · v{apiInfo.api.version}
          </p>
        </Card>
      )}

      {apiInfo && apiInfo.endpoints.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-base mb-4 text-main">Select endpoint</h3>
          <div className="flex flex-col gap-2">
            {apiInfo.endpoints.map(ep => (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpointId(ep.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer text-left border ${
                  selectedEndpointId === ep.id
                    ? 'bg-panel-hover border-main text-main font-medium'
                    : 'bg-panel border-border text-main hover:bg-panel-hover'
                }`}
              >
                <span className="px-2 py-0.5 rounded text-[0.7rem] font-mono border bg-bg border-border">
                  {ep.method}
                </span>
                <span className="font-mono text-sm">{ep.path}</span>
                <span className="text-muted text-xs ml-auto">{ep.name}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
          <div>
            <h3 className="text-base m-0 mb-1 text-main">Call and pay</h3>
            <p className="text-xs text-muted m-0 flex items-center gap-1.5">
              <Fuel size={12} /> Metered per request, paid from your credit
            </p>
          </div>
          <Button
            variant="primary"
            onClick={signedIn ? handleCall : openSignIn}
            disabled={signedIn && (!selectedEndpoint || !canPay || state === 'paying')}
          >
            {state === 'paying' ? <Spinner size={16} /> : <Zap size={16} />}
            {!signedIn
              ? 'Sign in to call'
              : state === 'paying'
                ? 'Paying and calling…'
                : `Call ${selectedEndpoint?.method || ''} ${selectedEndpoint?.path || ''}`}
          </Button>
        </div>

        {signedIn && !canPay && quote && (
          <p className="mt-4 text-xs text-muted border border-border rounded-md px-3 py-2 m-0">
            {!hasCredit
              ? 'Add credit on your Account page before making paid calls.'
              : `Not enough credit. This call costs ${quote.pricePerRequest} and you have ${quote.balance.toFixed(2)}.`}
          </p>
        )}

        {state === 'error' && error && (
          <div className="mt-4 px-4 py-3 rounded-md flex items-center gap-2 border bg-error/10 border-error/40 text-error">
            <AlertCircle size={16} />
            <span className="text-[0.85rem] font-medium">{error}</span>
          </div>
        )}

        {result?.payment && (
          <div className="mt-4 px-4 py-3 bg-panel border border-border rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} className="text-main" />
              <span className="text-[0.75rem] uppercase tracking-wide text-muted font-medium">
                Paid
              </span>
            </div>
            <div className="flex gap-8 text-[0.85rem] flex-wrap">
              <div>
                <span className="text-muted">Paid </span>
                <span className="font-mono text-main">${result.payment.amountUsdc}</span>
              </div>
              <div>
                <span className="text-muted">Latency </span>
                <span className="font-mono text-main">{result.latencyMs} ms</span>
              </div>
              <a
                href={result.payment.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-main underline"
              >
                {result.payment.txId.slice(0, 12)}… <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </Card>

      {result && (
        <Card>
          <h3 className="text-base mb-3 text-main">API response</h3>
          <pre className="bg-bg border border-border rounded-md p-4 overflow-auto max-h-[400px] font-mono text-xs leading-relaxed text-main">
            {JSON.stringify(result.response, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default ConsumerTest;
