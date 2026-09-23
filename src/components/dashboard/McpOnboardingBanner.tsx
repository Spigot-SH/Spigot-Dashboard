'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ClaudeLogo } from '../common/ClaudeLogo';
import {
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const MCP_SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_URL || 'https://spigot-mcp-production.up.railway.app/mcp';

interface McpOnboardingBannerProps {
  className?: string;
  defaultExpanded?: boolean;
  onOpenTutorial?: () => void;
}

export const McpOnboardingBanner: React.FC<McpOnboardingBannerProps> = ({
  className = '',
  defaultExpanded = true,
  onOpenTutorial,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load user preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spigot_mcp_guide_expanded');
      if (stored !== null) {
        setIsExpanded(stored === 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Card
      className={`relative overflow-hidden border border-accent/40 bg-gradient-to-br from-panel to-panel-hover shadow-lg transition-all ${className}`}
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      {/* Header bar */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-bg/70 px-2.5 py-1.5 shadow-sm shrink-0">
            <Logo size={20} className="text-accent" />
            <span className="text-[11px] text-muted">→</span>
            <ClaudeLogo size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-main">Spigot MCP Server for Claude.ai</h2>
            <p className="mt-0.5 text-xs text-muted">
              Connect Claude.ai directly to your Spigot MCP server to call real-time, paid APIs on demand.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {onOpenTutorial && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <ClaudeLogo size={14} /> Setup Tutorial
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
                Hide Guide <ChevronUp size={14} />
              </>
            ) : (
              <>
                View Setup Guide <ChevronDown size={14} />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Server URL Bar - Always visible */}
      <div className="border-t border-border/80 bg-bg/60 px-5 py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              MCP Server Endpoint:
            </span>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:max-w-xl sm:justify-end">
            <div className="flex flex-1 items-center rounded-md border border-border bg-panel px-3 py-1.5 font-mono text-xs text-main selection:bg-accent/30">
              <span className="truncate">{MCP_SERVER_URL}</span>
            </div>
            <Button
              variant={copied ? 'secondary' : 'primary'}
              size="sm"
              onClick={copyUrl}
              className="flex shrink-0 items-center gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-success" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy URL
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Step-by-Step Tutorial */}
      {isExpanded && (
        <div className="border-t border-border/80 bg-panel/50 px-5 py-5">
          <div className="mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Step-by-Step Connection Tutorial (Claude.ai)
            </h3>
          </div>

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
                Set Name to <strong className="text-main">Spigot MCP</strong> and paste the server URL:{' '}
                <code className="rounded bg-bg px-1 py-0.5 font-mono text-[10px] text-accent-dim">
                  .../mcp
                </code>
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
                Click <strong className="text-main">Save</strong>. Claude will connect and enable
                your tools. Ask Claude to query live market rates or fetch API data!
              </p>
            </div>
          </div>

          {/* Sample Prompts Box */}
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border/60 bg-bg/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
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
    </Card>
  );
};
