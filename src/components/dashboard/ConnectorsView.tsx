'use client';

import React from 'react';
import { ConsoleCover, CONSOLE_COVERS } from './ConsoleCover';
import { McpOnboardingBanner } from './McpOnboardingBanner';
import { Terminal, Shield, Zap } from 'lucide-react';

interface ConnectorsViewProps {
  publisherId?: string;
  onOpenTutorial?: (connector?: 'claude' | 'opencode') => void;
}

export const ConnectorsView: React.FC<ConnectorsViewProps> = ({
  onOpenTutorial,
}) => {
  return (
    <div className="flex flex-col gap-8 pb-12">
      <ConsoleCover
        src={CONSOLE_COVERS.provider}
        title="AI Connectors & MCP Tutorials"
        subtitle="Connect Spigot's metered tools, live datasets, and monetized endpoints to Claude.ai and OpenCode via MCP."
      />

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-panel/70 p-4">
          <div className="rounded-lg bg-accent/15 p-2 text-accent">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-main">Instant Streaming Tools</h3>
            <p className="mt-1 text-xs text-muted">
              AI agents automatically discover and call your monetized APIs via Model Context Protocol.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-panel/70 p-4">
          <div className="rounded-lg bg-accent/15 p-2 text-accent">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-main">Gasless Micropayments</h3>
            <p className="mt-1 text-xs text-muted">
              Calls are settled seamlessly per request using USDC credit on Algorand testnet.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-panel/70 p-4">
          <div className="rounded-lg bg-accent/15 p-2 text-accent">
            <Terminal size={18} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-main">Multi-Agent Support</h3>
            <p className="mt-1 text-xs text-muted">
              Toggle between OpenCode (CLI) and Claude.ai (Web) to view quick start instructions.
            </p>
          </div>
        </div>
      </div>

      {/* Unified Interactive Tutorial Banner with Selector */}
      <McpOnboardingBanner
        defaultExpanded={true}
        onOpenTutorial={onOpenTutorial}
      />
    </div>
  );
};

export default ConnectorsView;
