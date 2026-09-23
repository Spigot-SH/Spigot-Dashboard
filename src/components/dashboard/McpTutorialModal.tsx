'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ClaudeLogo } from '../common/ClaudeLogo';
import {
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  X,
} from 'lucide-react';

export const MCP_SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_URL || 'https://spigot-mcp-production.up.railway.app/mcp';

interface McpTutorialModalProps {
  isOpen: boolean;
  onComplete: () => void;
  canClose?: boolean;
  onClose?: () => void;
}

export const McpTutorialModal: React.FC<McpTutorialModalProps> = ({
  isOpen,
  onComplete,
  canClose = false,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#d97757]/10 blur-3xl" />

        {/* Modal Header */}
        <div className="border-b border-border/80 bg-panel px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/70 px-2.5 py-1.5 shadow-sm">
                <Logo size={22} className="text-accent" />
                <ArrowRight size={13} className="text-muted" />
                <ClaudeLogo size={22} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-main">Connect Spigot to Claude.ai</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Enable Claude to call Spigot&apos;s live data and paid APIs on demand via MCP.
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
        </div>

        {/* Modal Body / All Steps in Single Squashed Layout */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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
                variant={copied ? 'secondary' : 'primary'}
                size="sm"
                onClick={copyUrl}
                className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
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
                In the Settings sidebar, choose <strong className="text-main">Connectors</strong> and click the{' '}
                <strong className="text-main">&quot;Add custom connector&quot;</strong> button.
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
                Name it <strong className="text-main">Spigot MCP</strong>, paste the copied server URL into the URL field, and click <strong className="text-main">Add</strong>.
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
        </div>

        {/* Modal Footer / Unlock Action */}
        <div className="border-t border-border/80 bg-panel px-6 py-4">
          <Button
            variant="primary"
            size="md"
            onClick={onComplete}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold"
          >
            I&apos;ve Connected to Claude · Enter Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
