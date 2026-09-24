'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ClaudeLogo } from '../common/ClaudeLogo';
import { OpenCodeLogo } from '../common/OpenCodeLogo';
import {
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Terminal,
  FileCode,
  X,
} from 'lucide-react';

export const MCP_SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_URL || 'https://spigot-mcp-production.up.railway.app/mcp';

export const OPENCODE_CLI_CMD = `opencode mcp add spigot --url ${MCP_SERVER_URL}`;

export const OPENCODE_JSON_CONFIG = JSON.stringify(
  {
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

interface McpTutorialModalProps {
  isOpen: boolean;
  onComplete: () => void;
  canClose?: boolean;
  onClose?: () => void;
  initialConnector?: 'claude' | 'opencode';
}

export const McpTutorialModal: React.FC<McpTutorialModalProps> = ({
  isOpen,
  onComplete,
  canClose = false,
  onClose,
  initialConnector = 'claude',
}) => {
  const [connector, setConnector] = useState<'claude' | 'opencode'>(initialConnector);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Sync initial connector if changed
  useEffect(() => {
    setConnector(initialConnector);
  }, [initialConnector]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-all"
      onClick={() => {
        if (canClose && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-accent/40 bg-panel shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle ambient lighting */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div
          className={`pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full blur-3xl transition-all ${
            connector === 'claude' ? 'bg-[#d97757]/10' : 'bg-emerald-500/10'
          }`}
        />

        {/* Modal Header */}
        <div className="border-b border-border/80 bg-panel px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/70 px-2.5 py-1.5 shadow-sm">
                <Logo size={22} className="text-accent" />
                <ArrowRight size={13} className="text-muted" />
                {connector === 'claude' ? (
                  <ClaudeLogo size={22} />
                ) : (
                  <OpenCodeLogo size={22} className="text-main" />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-main">
                  {connector === 'claude'
                    ? 'Connect Spigot to Claude.ai'
                    : 'Connect Spigot to OpenCode'}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {connector === 'claude'
                    ? "Enable Claude to call Spigot's live data and paid APIs on demand via MCP."
                    : "Enable OpenCode coding agent to call Spigot's live data and paid APIs on demand via MCP."}
                </p>
              </div>
            </div>

            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-panel-hover hover:text-main"
                aria-label="Close tutorial"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Connector Selector Tabs */}
          <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted mr-1">
              Select Client:
            </span>
            <button
              type="button"
              onClick={() => setConnector('claude')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                connector === 'claude'
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/40 shadow-sm'
                  : 'bg-bg/60 text-muted hover:text-main hover:bg-panel-hover'
              }`}
            >
              <ClaudeLogo size={15} />
              <span>Claude.ai</span>
            </button>

            <button
              type="button"
              onClick={() => setConnector('opencode')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                connector === 'opencode'
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/40 shadow-sm'
                  : 'bg-bg/60 text-muted hover:text-main hover:bg-panel-hover'
              }`}
            >
              <OpenCodeLogo size={15} className="text-main" />
              <span>OpenCode</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* ================= CLAUDE.AI VIEW ================= */}
          {connector === 'claude' && (
            <>
              {/* MCP Server Endpoint Bar */}
              <div className="rounded-xl border border-border/90 bg-bg/80 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Spigot MCP Server URL
                  </span>
                  <a
                    href="https://claude.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    Open Claude.ai <ExternalLink size={11} />
                  </a>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center rounded-lg border border-border bg-panel px-3 py-1.5 font-mono text-xs text-main selection:bg-accent/30">
                    <span className="truncate">{MCP_SERVER_URL}</span>
                  </div>
                  <Button
                    variant={copiedUrl ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={copyUrl}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
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
                </div>
              </div>

              {/* Squashed 4-Step Grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* Step 1 */}
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-panel/70 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      1
                    </span>
                    <span className="text-xs font-semibold text-main">Open Claude Settings</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Go to{' '}
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
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-panel/70 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      2
                    </span>
                    <span className="text-xs font-semibold text-main">Go to Connectors</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    In the Settings sidebar, choose <strong className="text-main">Connectors</strong>{' '}
                    and click the <strong className="text-main">&quot;Add custom connector&quot;</strong>{' '}
                    button.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-panel/70 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      3
                    </span>
                    <span className="text-xs font-semibold text-main">Add Spigot MCP</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Name it <strong className="text-main">Spigot MCP</strong>, paste the copied server URL
                    into the URL field, and click <strong className="text-main">Add</strong>.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-panel/70 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                      4
                    </span>
                    <span className="text-xs font-semibold text-main">Prompt Claude</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Start a chat and ask Claude:{' '}
                    <span className="font-mono text-[11px] text-accent">
                      &ldquo;What is the current BTC spot price using Spigot?&rdquo;
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ================= OPENCODE VIEW ================= */}
          {connector === 'opencode' && (
            <>
              {/* Option A: Fast CLI Command */}
              <div className="rounded-xl border border-border/90 bg-bg/80 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-accent" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Option A: One-Line CLI Command (Fastest)
                    </span>
                  </div>
                  <a
                    href="https://opencode.ai/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    OpenCode Docs <ExternalLink size={11} />
                  </a>
                </div>
                <p className="mb-2 text-xs text-muted">
                  Run this command anywhere in your terminal to instantly add Spigot MCP to OpenCode:
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center rounded-lg border border-border bg-panel px-3 py-1.5 font-mono text-xs text-main selection:bg-accent/30 overflow-x-auto">
                    <span className="whitespace-nowrap">{OPENCODE_CLI_CMD}</span>
                  </div>
                  <Button
                    variant={copiedCmd ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={copyCmd}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedCmd ? (
                      <>
                        <Check size={14} className="text-success" /> Copied Command!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Command
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Option B: opencode.json Configuration */}
              <div className="rounded-xl border border-border/90 bg-bg/80 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FileCode size={14} className="text-accent" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Option B: Add to opencode.json / opencode.jsonc
                    </span>
                  </div>
                  <Button
                    variant={copiedJson ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={copyJson}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedJson ? (
                      <>
                        <Check size={14} className="text-success" /> Copied JSON!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy JSON
                      </>
                    )}
                  </Button>
                </div>
                <p className="mb-2 text-xs text-muted">
                  Add this block to <code className="text-main font-mono">opencode.json</code> in your project root or{' '}
                  <code className="text-main font-mono">~/.config/opencode/opencode.json</code>:
                </p>
                <pre className="rounded-lg border border-border bg-panel p-3 font-mono text-xs text-main overflow-x-auto">
                  {OPENCODE_JSON_CONFIG}
                </pre>
              </div>

              {/* Step 3: Run / Prompt OpenCode */}
              <div className="rounded-xl border border-border/80 bg-panel/70 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                    ✓
                  </span>
                  <span className="text-xs font-semibold text-main">Prompt OpenCode</span>
                </div>
                <p className="text-xs leading-relaxed text-muted mb-2">
                  Launch OpenCode in your terminal or prompt directly:
                </p>
                <div className="rounded-lg border border-border bg-bg/90 px-3 py-2 font-mono text-xs text-accent">
                  opencode &quot;What is the current BTC spot price using Spigot?&quot;
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer / Unlock Action */}
        <div className="border-t border-border/80 bg-panel px-6 py-4">
          <Button
            variant="primary"
            size="md"
            onClick={onComplete}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold"
          >
            I&apos;ve Connected to {connector === 'claude' ? 'Claude' : 'OpenCode'} · Enter Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default McpTutorialModal;
