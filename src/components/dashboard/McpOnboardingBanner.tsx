'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ClaudeLogo } from '../common/ClaudeLogo';
import { OpenCodeLogo } from '../common/OpenCodeLogo';
import {
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Terminal,
  ArrowRight,
} from 'lucide-react';

export const MCP_SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_URL || 'https://spigot-mcp-production.up.railway.app/mcp';

export const OPENCODE_CLI_CMD = `opencode mcp add spigot --url ${MCP_SERVER_URL}`;

export const OPENCODE_JSON_CONFIG = JSON.stringify(
  {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      servers: {
        spigot: {
          type: 'remote',
          url: MCP_SERVER_URL,
        },
      },
    },
  },
  null,
  2
);

interface McpOnboardingBannerProps {
  className?: string;
  defaultExpanded?: boolean;
  onOpenTutorial?: (connector?: 'claude' | 'opencode') => void;
  initialConnector?: 'claude' | 'opencode';
}

export const McpOnboardingBanner: React.FC<McpOnboardingBannerProps> = ({
  className = '',
  defaultExpanded = true,
  onOpenTutorial,
  initialConnector,
}) => {
  const [connector, setConnector] = useState<'claude' | 'opencode'>('opencode');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load user preference on mount
  useEffect(() => {
    try {
      const storedConnector = localStorage.getItem('spigot_mcp_selected_connector');
      if (initialConnector) {
        setConnector(initialConnector);
      } else if (storedConnector === 'claude' || storedConnector === 'opencode') {
        setConnector(storedConnector);
      }
      const storedExpanded = localStorage.getItem('spigot_mcp_guide_expanded');
      if (storedExpanded !== null) {
        setIsExpanded(storedExpanded === 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [initialConnector]);

  const selectConnector = (c: 'claude' | 'opencode') => {
    setConnector(c);
    try {
      localStorage.setItem('spigot_mcp_selected_connector', c);
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spigot_mcp_guide_expanded', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  const copyUrl = useCallback(() => {
    void navigator.clipboard?.writeText(MCP_SERVER_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }, []);

  const copyCmd = useCallback(() => {
    void navigator.clipboard?.writeText(OPENCODE_CLI_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  }, []);

  const copyJson = useCallback(() => {
    void navigator.clipboard?.writeText(OPENCODE_JSON_CONFIG);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }, []);

  const isOpencode = connector === 'opencode';

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-300 ${
        isOpencode
          ? 'border-emerald-500/35 bg-gradient-to-br from-panel via-panel-hover to-panel shadow-lg'
          : 'border-[#d97757]/35 bg-gradient-to-br from-panel via-panel-hover to-panel shadow-lg'
      } ${className}`}
    >
      {/* Background glow */}
      <div
        className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl transition-colors duration-500 ${
          isOpencode ? 'bg-emerald-500/10' : 'bg-[#d97757]/10'
        }`}
      />

      {/* Header bar */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 shadow-sm shrink-0">
            <Logo size={20} className="text-accent" />
            <ArrowRight size={13} className="text-muted" />
            {isOpencode ? (
              <OpenCodeLogo size={20} className="text-main" />
            ) : (
              <ClaudeLogo size={20} />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-main">
                {isOpencode ? 'Spigot MCP for OpenCode' : 'Spigot MCP for Claude.ai'}
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  isOpencode
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-[#d97757]/15 text-[#d97757] ring-1 ring-[#d97757]/30'
                }`}
              >
                {isOpencode ? 'Terminal & CLI Agent' : 'Web & Desktop'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {isOpencode
                ? 'Connect OpenCode coding agent to Spigot MCP to execute monetized API tools from your terminal.'
                : 'Connect Claude.ai directly to Spigot MCP to query live data feeds and call paid APIs on demand.'}
            </p>
          </div>
        </div>

        {/* Right side: Client Selector Toggle & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {/* Connector Selector Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-bg/90 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => selectConnector('opencode')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                isOpencode
                  ? 'bg-panel text-main shadow ring-1 ring-border text-emerald-400'
                  : 'text-muted hover:text-main'
              }`}
              title="Switch to OpenCode tutorial"
            >
              <OpenCodeLogo size={14} className={isOpencode ? 'text-emerald-400' : 'text-muted'} />
              <span>OpenCode</span>
            </button>
            <button
              type="button"
              onClick={() => selectConnector('claude')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                !isOpencode
                  ? 'bg-panel text-main shadow ring-1 ring-border text-[#d97757]'
                  : 'text-muted hover:text-main'
              }`}
              title="Switch to Claude.ai tutorial"
            >
              <ClaudeLogo size={14} />
              <span>Claude.ai</span>
            </button>
          </div>

          {onOpenTutorial && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenTutorial(connector)}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              {isOpencode ? <OpenCodeLogo size={14} className="text-main" /> : <ClaudeLogo size={14} />}
              <span>Full Tutorial</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 text-xs"
          >
            {isExpanded ? (
              <>
                Hide <ChevronUp size={14} />
              </>
            ) : (
              <>
                Guide <ChevronDown size={14} />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Endpoint / CLI Command Bar */}
      <div className="border-t border-border/80 bg-bg/60 px-5 py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {isOpencode ? (
              <>
                <Terminal size={14} className="text-accent" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  Fast CLI Command:
                </span>
              </>
            ) : (
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Spigot MCP Endpoint:
              </span>
            )}
          </div>

          <div className="flex flex-1 items-center gap-2 sm:max-w-xl sm:justify-end">
            <div className="flex flex-1 items-center rounded-md border border-border bg-panel px-3 py-1.5 font-mono text-xs text-main selection:bg-accent/30 overflow-x-auto">
              <span className="whitespace-nowrap">
                {isOpencode ? OPENCODE_CLI_CMD : MCP_SERVER_URL}
              </span>
            </div>
            {isOpencode ? (
              <Button
                variant={copiedCmd ? 'secondary' : 'primary'}
                size="sm"
                onClick={copyCmd}
                className="flex shrink-0 items-center gap-1.5 text-xs"
              >
                {copiedCmd ? (
                  <>
                    <Check size={14} className="text-success" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Command
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant={copiedUrl ? 'secondary' : 'primary'}
                size="sm"
                onClick={copyUrl}
                className="flex shrink-0 items-center gap-1.5 text-xs"
              >
                {copiedUrl ? (
                  <>
                    <Check size={14} className="text-success" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy URL
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Step-by-Step Instructions */}
      {isExpanded && (
        <div className="border-t border-border/80 bg-panel/50 px-5 py-5 space-y-4">
          {/* ================= OPENCODE VIEW ================= */}
          {isOpencode && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Method 1: CLI */}
                <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-panel p-3.5">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                        1
                      </span>
                      <span className="text-xs font-medium text-main">Option A: Run in Terminal</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted mb-2">
                      Execute this single command anywhere in your terminal to register Spigot MCP:
                    </p>
                    <div className="rounded border border-border bg-bg/80 px-2.5 py-1.5 font-mono text-[11px] text-accent overflow-x-auto">
                      {OPENCODE_CLI_CMD}
                    </div>
                  </div>
                </div>

                {/* Method 2: opencode.json */}
                <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-panel p-3.5">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                          2
                        </span>
                        <span className="text-xs font-medium text-main">Option B: opencode.json</span>
                      </div>
                      <Button
                        variant={copiedJson ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={copyJson}
                        className="flex shrink-0 items-center gap-1 text-[11px] h-6 px-2"
                      >
                        {copiedJson ? (
                          <>
                            <Check size={11} className="text-success" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted mb-2">
                      Or add to <code className="font-mono text-main">opencode.json</code> in project root or{' '}
                      <code className="font-mono text-main">~/.config/opencode/opencode.json</code>:
                    </p>
                    <pre className="rounded border border-border bg-bg/80 p-2 font-mono text-[10px] text-main overflow-x-auto max-h-24">
                      {OPENCODE_JSON_CONFIG}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Sample Prompt Box */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-bg/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-main">Prompt OpenCode:</span>
                  <span className="font-mono text-xs text-accent">
                    opencode &quot;What is the current BTC spot price using Spigot?&quot;
                  </span>
                </div>
                <a
                  href="https://opencode.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  OpenCode Docs <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* ================= CLAUDE.AI VIEW ================= */}
          {!isOpencode && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {/* Step 1 */}
                <div className="flex flex-col rounded-lg border border-border/70 bg-panel p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      1
                    </span>
                    <span className="text-xs font-medium text-main">Open Claude Settings</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Navigate to{' '}
                    <a
                      href="https://claude.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      Claude.ai
                    </a>
                    , click your profile in the bottom-left corner, and select{' '}
                    <strong className="text-main">Settings</strong> (⚙).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col rounded-lg border border-border/70 bg-panel p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      2
                    </span>
                    <span className="text-xs font-medium text-main">Go to Connectors</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    In the Settings menu, click on{' '}
                    <strong className="text-main">Connectors</strong> and click the{' '}
                    <strong className="text-main">&quot;Add custom connector&quot;</strong> button.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col rounded-lg border border-border/70 bg-panel p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      3
                    </span>
                    <span className="text-xs font-medium text-main">Paste Spigot URL</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Set Name to <strong className="text-main">Spigot MCP</strong> and paste the server URL. Click{' '}
                    <strong className="text-main">Add</strong>.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col rounded-lg border border-border/70 bg-panel p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      4
                    </span>
                    <span className="text-xs font-medium text-main">Start Chatting</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Claude will connect and enable your tools. Ask Claude to query live market rates or fetch API data!
                  </p>
                </div>
              </div>

              {/* Sample Prompts Box */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-bg/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-main">Try asking Claude:</span>
                  <span className="font-mono text-xs text-muted">
                    &ldquo;What is the current BTC spot price using Spigot?&rdquo;
                  </span>
                </div>
                <a
                  href="https://claude.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Open Claude.ai <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default McpOnboardingBanner;
