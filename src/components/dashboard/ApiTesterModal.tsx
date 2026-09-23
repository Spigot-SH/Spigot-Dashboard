'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Play,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Fuel,
  Wallet,
  Coins,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { PublishedApi, PublishedEndpoint, catalogApi, ConsumeResponse, ApiQuote } from '../../api/catalog';
import { useAuth } from '../../auth/AuthContext';
import { formatCredit } from '../../lib/format';

interface ApiTesterModalProps {
  api: PublishedApi | null;
  isOpen: boolean;
  onClose: () => void;
  onAddCredit?: () => void;
}

export const ApiTesterModal: React.FC<ApiTesterModalProps> = ({
  api,
  isOpen,
  onClose,
  onAddCredit,
}) => {
  const { signedIn, openSignIn, credits, refresh } = useAuth();

  const [selectedEndpoint, setSelectedEndpoint] = useState<PublishedEndpoint | null>(null);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [requestBody, setRequestBody] = useState<string>('');
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [result, setResult] = useState<ConsumeResponse | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // Initialize selected endpoint and pre-fill example request when API changes
  useEffect(() => {
    if (!api || !api.endpoints?.length) {
      setSelectedEndpoint(null);
      setRequestBody('');
      setResult(null);
      setCallError(null);
      return;
    }

    const defaultEp = api.endpoints[0];
    setSelectedEndpoint(defaultEp);
    setResult(null);
    setCallError(null);

    if (defaultEp.example_request) {
      try {
        const parsed = typeof defaultEp.example_request === 'string'
          ? JSON.parse(defaultEp.example_request)
          : defaultEp.example_request;
        setRequestBody(JSON.stringify(parsed, null, 2));
      } catch {
        setRequestBody(String(defaultEp.example_request));
      }
    } else {
      setRequestBody('');
    }
  }, [api]);

  // Load quote for affordability and balance check
  const loadQuote = useCallback(async () => {
    if (!api?.slug || !signedIn) return;
    try {
      const q = await catalogApi.getQuote(api.slug);
      setQuote(q);
    } catch {
      // Fallback quote derived from API info
      setQuote({
        pricePerRequest: api.pricePerRequest ?? 0,
        currency: 'USDC',
        balance: credits ?? 0,
        canPay: (credits ?? 0) >= (api.pricePerRequest ?? 0),
        callsAffordable: api.pricePerRequest && api.pricePerRequest > 0
          ? Math.floor((credits ?? 0) / api.pricePerRequest)
          : 999,
      });
    }
  }, [api?.slug, api?.pricePerRequest, signedIn, credits]);

  useEffect(() => {
    if (isOpen && api) {
      void loadQuote();
    }
  }, [isOpen, api, loadQuote]);

  // Handle endpoint selection change
  const handleSelectEndpoint = (ep: PublishedEndpoint) => {
    setSelectedEndpoint(ep);
    setResult(null);
    setCallError(null);
    if (ep.example_request) {
      try {
        const parsed = typeof ep.example_request === 'string'
          ? JSON.parse(ep.example_request)
          : ep.example_request;
        setRequestBody(JSON.stringify(parsed, null, 2));
      } catch {
        setRequestBody(String(ep.example_request));
      }
    } else {
      setRequestBody('');
    }
  };

  // Execute paid consume call
  const handleExecuteCall = async () => {
    if (!api || !selectedEndpoint) return;
    if (!signedIn) {
      openSignIn();
      return;
    }

    setIsCalling(true);
    setCallError(null);
    setResult(null);

    let parsedBody: unknown = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && requestBody.trim()) {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch {
        setCallError('Invalid JSON format in request body.');
        setIsCalling(false);
        return;
      }
    }

    try {
      const response = await catalogApi.consume(api.slug, {
        endpointId: selectedEndpoint.id,
        body: parsedBody,
      });

      setResult(response);
      if (!response.ok) {
        setCallError(
          response.error || response.reason || `Upstream returned status ${response.status}`,
        );
      }

      // Refresh balance across app
      void refresh();
      void loadQuote();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'API call failed';
      setCallError(msg);
    } finally {
      setIsCalling(false);
    }
  };

  const handleCopyResponse = () => {
    if (!result?.response) return;
    const text = typeof result.response === 'string'
      ? result.response
      : JSON.stringify(result.response, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  if (!isOpen || !api) return null;

  const cost = api.pricePerRequest ?? 0;
  const balance = quote?.balance ?? credits ?? 0;
  const canAfford = balance >= cost;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl bg-panel border border-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent font-semibold">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-main">{api.name}</h3>
                <span className="rounded bg-panel-hover border border-border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted">
                  {api.slug}
                </span>
              </div>
              <p className="text-xs text-muted">
                Metered via Algorand x402
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-panel-hover hover:text-main cursor-pointer transition-colors"
            title="Close tester"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Credit & Pricing Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-bg/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel border border-border text-accent">
                <Coins size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted font-medium">Cost Per Request</span>
                  <span className="font-mono text-sm font-semibold text-accent">
                    {cost > 0 ? `$${cost.toFixed(4)} USDC` : 'Free'}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  Paid automatically from your credit · No wallet signature required
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted">Your USDC Credit</div>
                <div className="font-mono text-sm font-semibold text-main">
                  {formatCredit(balance)}
                </div>
              </div>

              {!canAfford && onAddCredit && (
                <Button variant="primary" size="sm" onClick={onAddCredit}>
                  <Wallet size={14} className="mr-1.5" /> Add Credit
                </Button>
              )}
            </div>
          </div>

          {/* Endpoint Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Select Endpoint to Test ({api.endpoints.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {api.endpoints.map(ep => {
                const isSelected = selectedEndpoint?.id === ep.id;
                const methodColor =
                  ep.method === 'GET'
                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                    : ep.method === 'POST'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : ep.method === 'DELETE'
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => handleSelectEndpoint(ep)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-border bg-panel hover:bg-panel-hover hover:border-border/80'
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.7rem] font-bold border ${methodColor}`}
                    >
                      {ep.method}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-medium text-main truncate">
                        {ep.path}
                      </div>
                      <div className="text-[0.7rem] text-muted truncate">
                        {ep.description || ep.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Request Payload Editor (for POST/PUT/PATCH) */}
          {selectedEndpoint && ['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Request JSON Body
                </label>
                {selectedEndpoint.example_request && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = typeof selectedEndpoint.example_request === 'string'
                          ? JSON.parse(selectedEndpoint.example_request)
                          : selectedEndpoint.example_request;
                        setRequestBody(JSON.stringify(parsed, null, 2));
                      } catch {
                        setRequestBody(String(selectedEndpoint.example_request));
                      }
                    }}
                    className="text-[0.7rem] text-accent hover:underline cursor-pointer"
                  >
                    Reset to example
                  </button>
                )}
              </div>
              <textarea
                value={requestBody}
                onChange={e => setRequestBody(e.target.value)}
                placeholder='{\n  "key": "value"\n}'
                rows={4}
                className="w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs text-main placeholder-muted/50 focus:border-accent focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Call Error Alert */}
          {callError && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 p-3 text-error text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{callError}</span>
            </div>
          )}

          {/* Results Box */}
          {result && (
            <div className="space-y-3 rounded-xl border border-border bg-bg/80 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold border ${
                      result.ok
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {result.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {result.status} {result.ok ? 'OK' : 'Error'}
                  </span>

                  <span className="flex items-center gap-1 font-mono text-xs text-muted">
                    <Clock size={13} /> {result.latencyMs}ms
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    className="inline-flex items-center gap-1 rounded border border-border bg-panel px-2 py-1 text-xs text-muted hover:text-main hover:bg-panel-hover transition-colors cursor-pointer"
                  >
                    {copiedResponse ? (
                      <>
                        <Check size={12} className="text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy JSON
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* On-Chain Payment Receipt */}
              {result.payment && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel/70 border border-border px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <Fuel size={13} className="text-accent" />
                    <span>
                      Paid <strong className="font-mono text-main">${result.payment.amountUsdc} USDC</strong>
                    </span>
                  </div>
                  {result.payment.txId && (
                    <a
                      href={result.payment.explorerUrl || `https://lora.algokit.io/testnet/transaction/${result.payment.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-accent hover:underline"
                    >
                      Tx: {result.payment.txId.slice(0, 10)}… <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              {/* Response JSON Inspector */}
              <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-bg p-3.5 font-mono text-xs leading-relaxed text-main">
                {typeof result.response === 'string'
                  ? result.response
                  : JSON.stringify(result.response, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-bg/50">
          <a
            href={`/test/${api.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent font-medium transition-colors"
          >
            Open Standalone Tester <ExternalLink size={12} />
          </a>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteCall}
              disabled={isCalling || (!canAfford && cost > 0) || !selectedEndpoint}
            >
              {isCalling ? (
                <>
                  <Spinner size={14} className="mr-1.5" /> Calling & Paying…
                </>
              ) : (
                <>
                  <Play size={14} className="mr-1.5 fill-current" />
                  {cost > 0 ? `Pay $${cost.toFixed(4)} & Call` : 'Call Endpoint'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTesterModal;
