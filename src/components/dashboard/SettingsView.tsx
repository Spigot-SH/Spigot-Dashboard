'use client';

import React, { useState } from 'react';
import { Card } from '../common/Card';
import { apiClient, getApiKey, getPublisherId, setApiKey, setPublisherId } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';

interface SettingsViewProps {
  publisherId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ publisherId }) => {
  const { user, publisher, refresh } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const currentApiKey = apiKey || publisher?.api_key;
  const effectivePubId = publisher?.id || getPublisherId() || publisherId || 'active';
  const gatewayUrl =
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://spigot.sh');

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const name = user?.email ? user.email.split('@')[0] : 'My Publisher';
      const result = await apiClient.registerPublisher({ name });
      if (!result.api_key || !result.id) throw new Error('Server returned no key');
      setApiKey(result.api_key);
      setPublisherId(result.id);
      setApiKeyState(result.api_key);
      await refresh();
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Could not generate a key');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold text-main">Publisher Settings</h2>
        <p className="text-sm text-muted">
          Manage your publisher identity, x402 gateway authentication keys, and revenue payout
          destinations.
        </p>
      </div>

      {/* Account Info */}
      <Card header="Publisher Profile">
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              Publisher Name
            </label>
            <div className="text-sm font-medium text-main">
              {publisher?.name || user?.email?.split('@')[0] || 'My Publisher'}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              Contact / Session Email
            </label>
            <div className="text-sm font-mono text-main">{user?.email || 'session@spigot.sh'}</div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              Publisher ID
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted bg-panel px-3 py-2 rounded-md border border-border">
                {effectivePubId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy('pubId', effectivePubId)}
                className="p-2 rounded hover:bg-panel-hover text-muted hover:text-main cursor-pointer"
                title="Copy Publisher ID"
              >
                {copiedField === 'pubId' ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* API Key */}
      <Card header="Publisher API Key">
        <p className="text-xs text-muted mb-4">
          This key is used by the <code>spigot</code> CLI and SDKs to manage endpoints, upload
          OpenAPI specifications, and trigger settlements programmatically.
        </p>
        {currentApiKey ? (
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs text-main bg-panel px-3 py-2 rounded-md border border-border flex-1 select-all">
              {showKey ? currentApiKey : '••••••••••••••••••••••••••••••••••••••••••••'}
            </div>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="p-2 rounded hover:bg-panel-hover text-muted hover:text-main cursor-pointer"
              title={showKey ? 'Hide key' : 'Reveal key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              onClick={() => handleCopy('apiKey', currentApiKey)}
              className="p-2 rounded hover:bg-panel-hover text-muted hover:text-main cursor-pointer"
              title="Copy API Key"
            >
              {copiedField === 'apiKey' ? (
                <Check size={16} className="text-success" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-3">No API key yet.</p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-2 rounded-md border border-border bg-panel text-main text-sm"
            >
              {generating ? 'Generating...' : 'Generate API key'}
            </button>
            {genError ? <p className="text-sm text-error mt-2">{genError}</p> : null}
          </div>
        )}
      </Card>

      {/* Settlement & Payout */}
      <Card header="Revenue & Payout Destination">
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              Settlement Network
            </label>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs bg-accent/20 text-accent font-medium uppercase font-mono">
                Algorand Testnet
              </span>
              <span className="text-xs text-muted">ASA ID: 10458941 (USDC)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              Settlement Mode
            </label>
            <p className="text-xs text-muted">
              On-Demand & Real-Time. Payouts are verified cryptographically via Algorand atomic
              transaction groups and can be triggered on demand from the dashboard overview.
            </p>
          </div>
        </div>
      </Card>

      {/* Gateway Reference */}
      <Card header="Gateway Integration">
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-1.5">
              x402 Gateway Origin
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted bg-panel px-3 py-2 rounded-md border border-border flex-1 truncate">
                {gatewayUrl}/x402
              </span>
              <button
                type="button"
                onClick={() => handleCopy('gateway', `${gatewayUrl}/x402`)}
                className="p-2 rounded hover:bg-panel-hover text-muted hover:text-main cursor-pointer"
                title="Copy Gateway URL"
              >
                {copiedField === 'gateway' ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
