'use client';

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ClaudeLogo } from '../common/ClaudeLogo';
import { OpenCodeLogo } from '../common/OpenCodeLogo';
import { useAuth } from '../../auth/AuthContext';
import { formatCredit } from '../../lib/format';
import { Lock, Wallet, ArrowRight, Sparkles } from 'lucide-react';

interface TutorialLockedCardProps {
  balance?: number;
  onAddCredit: () => void;
  onUnlock: () => void;
  isUnlocking?: boolean;
  className?: string;
}

export const TutorialLockedCard: React.FC<TutorialLockedCardProps> = ({
  balance: balanceProp,
  onAddCredit,
  onUnlock,
  isUnlocking = false,
  className = '',
}) => {
  const { credits } = useAuth();
  const balance = balanceProp !== undefined ? balanceProp : (credits ?? 0);
  const UNLOCK_COST = 1.5;
  const hasEnoughCredit = balance >= UNLOCK_COST;

  return (
    <Card
      className={`relative overflow-hidden border border-accent/40 bg-gradient-to-br from-panel via-panel-hover to-panel shadow-2xl p-6 transition-all ${className}`}
    >
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#d97757]/15 blur-3xl" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Brand lockup and info */}
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 shadow-sm">
              <Logo size={20} className="text-accent" />
              <ArrowRight size={13} className="text-muted" />
              <div className="flex items-center gap-1.5">
                <ClaudeLogo size={18} />
                <span className="text-[10px] text-muted">/</span>
                <OpenCodeLogo size={16} className="text-main" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning ring-1 ring-warning/30">
              <Lock size={12} /> Tutorial Locked
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-main">
              Unlock Spigot MCP Tutorial & Dashboard Access
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Add credit to unlock the Spigot MCP connector tutorial for Claude.ai and OpenCode, and activate
              full dashboard access.
            </p>
          </div>

          {/* Balance status */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-lg border border-border bg-bg/70 px-3 py-1.5">
              <span className="text-muted">Your Balance: </span>
              <span className="font-semibold font-mono text-main">{formatCredit(balance)}</span>
            </div>
            {hasEnoughCredit ? (
              <span className="text-success text-xs font-medium">
                ✓ Ready to unlock
              </span>
            ) : (
              <span className="text-muted text-xs">
                Add credit to unlock
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {hasEnoughCredit ? (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={onUnlock}
                isLoading={isUnlocking}
                className="flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-accent/20"
              >
                <Sparkles size={16} /> Unlock Tutorial
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={onAddCredit}
                className="flex items-center justify-center gap-2 text-xs font-medium"
              >
                <Wallet size={14} /> Add Credit
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={onAddCredit}
                className="flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-accent/20"
              >
                <Wallet size={16} /> Add Credit
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled
                className="flex items-center justify-center gap-2 text-xs opacity-50 cursor-not-allowed"
                title="Add credit to unlock"
              >
                <Lock size={13} /> Unlock Tutorial
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default TutorialLockedCard;
