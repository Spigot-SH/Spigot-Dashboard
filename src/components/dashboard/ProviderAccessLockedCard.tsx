'use client';

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { Clock, Lock, Send } from 'lucide-react';

interface ProviderAccessLockedCardProps {
  /** `null`/`revoked` show the request button; `requested`/`approved` show the sent state. */
  providerAccess: 'requested' | 'approved' | 'revoked' | null;
  onRequestAccess: () => void;
  isRequesting?: boolean;
  className?: string;
}

/**
 * The provider side (publisher registration, API create/publish, the provider dashboard) is
 * coming soon. This is what a not-yet-approved account sees in its place — never a blurred
 * preview of real content, and never a generic load-failure message: the backend refuses these
 * figures outright for an unapproved account (routes/dashboard.ts, routes/apis.ts), the same
 * way it used to refuse them for a locked tutorial (see `TutorialLockedCard`, which this
 * replaces on the provider views — the $1.50 unlock no longer gates any of this).
 */
export const ProviderAccessLockedCard: React.FC<ProviderAccessLockedCardProps> = ({
  providerAccess,
  onRequestAccess,
  isRequesting = false,
  className = '',
}) => {
  const alreadyRequested = providerAccess === 'requested' || providerAccess === 'approved';

  return (
    <Card
      className={`relative overflow-hidden border border-accent/40 bg-gradient-to-br from-panel via-panel-hover to-panel shadow-2xl p-6 transition-all ${className}`}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#d97757]/15 blur-3xl" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 shadow-sm">
              <Logo size={20} className="text-accent" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning ring-1 ring-warning/30">
              <Lock size={12} /> Coming Soon
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-main">Selling APIs on Spigot is coming soon</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              The provider side — registering as a publisher, adding and publishing APIs, and the
              provider dashboard — is opening gradually. Request access and we will email you once
              an admin approves your account.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {alreadyRequested ? (
            <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg/70 px-4 py-2 text-xs font-medium text-muted">
              <Clock size={14} /> Requested — we&apos;ll email you
            </span>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={onRequestAccess}
              isLoading={isRequesting}
              className="flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-accent/20"
            >
              <Send size={16} /> Request access
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProviderAccessLockedCard;
