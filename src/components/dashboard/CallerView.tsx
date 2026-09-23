'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { Table, Th, Td, TdEmpty } from '../common/Table';
import { SkeletonRows } from '../common/Skeleton';
import { creditsApi, type CreditsOverview } from '../../api/credits';
import { errorMessage } from '../../lib/errors';
import { CreditCard, Wallet, Compass } from 'lucide-react';
import { ConsoleCover, CONSOLE_COVERS } from './ConsoleCover';
import { McpOnboardingBanner } from './McpOnboardingBanner';
import { TutorialLockedCard } from './TutorialLockedCard';
import { AddCreditModal } from '../../credits/TopUpPanel';
import { formatCredit } from '../../lib/format';

const KIND_LABEL: Record<string, string> = {
  RECHARGE: 'Top-up',
  SPEND: 'API call',
  REFUND: 'Refund',
  ADJUST: 'Adjustment',
};

/**
 * The console for somebody who calls APIs rather than publishes them.
 *
 * Every figure is derived from the rows `GET /api/credits` returned — the balance it reports,
 * and counts and sums over the history it sent. Nothing is defaulted: a failed load shows the
 * failure and no figures, the same rule the publisher overview follows.
 */
interface CallerViewProps {
  publisherId?: string;
  isUnlocked?: boolean;
  isCompleted?: boolean;
  onOpenTutorial?: () => void;
  onUnlockTutorial?: () => Promise<void>;
  isUnlocking?: boolean;
}

export const CallerView: React.FC<CallerViewProps> = ({
  publisherId,
  isUnlocked = true,
  isCompleted = true,
  onOpenTutorial,
  onUnlockTutorial,
  isUnlocking = false,
}) => {
  const router = useRouter();
  const [overview, setOverview] = useState<CreditsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [addingCredit, setAddingCredit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await creditsApi.overview());
      setLoadError(null);
    } catch (e: unknown) {
      // A failed load is not an empty account. Never fall back to zeros.
      setOverview(null);
      setLoadError(errorMessage(e, 'Could not load your credit.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  const handleUnlock = async () => {
    if (onUnlockTutorial) {
      await onUnlockTutorial();
    }
    await load();
  };

  if (loadError) {
    return (
      <EmptyState
        title="Could not load your credit"
        description={`${loadError} No figures are shown, because none loaded.`}
        action={
          <Button variant="primary" size="sm" onClick={() => setAttempt(n => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const history = overview?.history ?? [];
  const spends = history.filter(entry => entry.kind === 'SPEND');
  const spent = spends.reduce((total, entry) => total + Math.abs(entry.amount), 0);

  return (
    <div className="flex flex-col gap-8">
      <ConsoleCover
        src={CONSOLE_COVERS.caller}
        title="Your calls"
        subtitle="Credit you have, and every call it has paid for. Calls are metered per request."
        action={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                router.push(
                  publisherId ? `/dashboard/${publisherId}/explore` : '/dashboard/active/explore',
                )
              }
            >
              <Compass size={15} className="mr-1.5" /> Explore APIs
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAddingCredit(true)}>
              <Wallet size={15} className="mr-1.5" /> Add credit
            </Button>
          </div>
        }
      />

      {/*
        The same modal `/profile` opens, opened here instead of routing there. It said "Add
        credit" and then navigated to a page, which made it the third control on this screen
        pointing at `/profile`, alongside the sidebar row and the account menu. Now it does
        what it says. `overview` is already loaded here, and the modal needs nothing else.
      */}
      <AddCreditModal
        isOpen={addingCredit}
        onClose={() => setAddingCredit(false)}
        overview={overview}
        onCredited={load}
      />

      {!isUnlocked || !isCompleted ? (
        <TutorialLockedCard
          balance={overview?.balance ?? 0}
          onAddCredit={() => setAddingCredit(true)}
          onUnlock={handleUnlock}
          isUnlocking={isUnlocking}
        />
      ) : (
        <McpOnboardingBanner onOpenTutorial={onOpenTutorial} />
      )}

      {/* Dashboard metrics and activity: disabled & blurred if tutorial is not yet unlocked and completed */}
      <div
        className={`flex flex-col gap-8 transition-all duration-300 ${
          !isUnlocked || !isCompleted
            ? 'pointer-events-none select-none filter blur-[2px] opacity-40'
            : ''
        }`}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card hoverable className="relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 text-accent opacity-10">
              <CreditCard size={64} />
            </div>
            <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
              Credit available
            </h3>
            <div className="text-3xl">{loading ? '' : formatCredit(overview?.balance ?? 0)}</div>
          </Card>

          <Card hoverable>
            <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
              Paid calls recorded
            </h3>
            <div className="font-mono text-3xl">{loading ? '' : spends.length.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted">In the activity below</div>
          </Card>

          <Card hoverable>
            <h3 className="mb-2 text-sm font-normal uppercase tracking-wider text-muted">
              Spent on calls
            </h3>
            <div className="text-3xl">{loading ? '' : formatCredit(spent)}</div>
            <div className="mt-1 text-xs text-muted">Sum of the calls below</div>
          </Card>
        </div>

        <Card header="Activity" padding="none">
          <Table>
            <thead>
              <tr>
                <Th>What</Th>
                <Th>When</Th>
                <Th numeric>Amount</Th>
                <Th numeric>Balance after</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={4} rows={4} />
              ) : history.length > 0 ? (
                history.map(entry => (
                  <tr key={entry.id}>
                    <Td>{entry.description || KIND_LABEL[entry.kind] || entry.kind}</Td>
                    <Td>{new Date(entry.created_at).toLocaleString()}</Td>
                    <Td numeric className={entry.amount >= 0 ? 'text-accent font-medium' : ''}>
                      {entry.amount >= 0 ? '+' : '-'}
                      {formatCredit(Math.abs(entry.amount))}
                    </Td>
                    <Td numeric mono>
                      {formatCredit(entry.balance_after)}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <TdEmpty colSpan={4}>
                    <div className="py-8 flex flex-col items-center justify-center">
                      <p className="mb-1 text-sm font-medium text-main">No calls recorded yet</p>
                      <p className="text-xs text-muted max-w-sm text-center mb-4">
                        Discover published APIs in the marketplace and test endpoints live with your USDC credit balance.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          router.push(
                            publisherId
                              ? `/dashboard/${publisherId}/explore`
                              : '/dashboard/active/explore',
                          )
                        }
                      >
                        <Compass size={14} className="mr-1.5" /> Explore & Test APIs
                      </Button>
                    </div>
                  </TdEmpty>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default CallerView;
