'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { apiClient, setApiKey, setPublisherId } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/errors';

/** What the backend says about this publisher. null means the check has not answered yet. */
interface Progress {
  endpoints: number;
  paidCalls: number;
  hasWallet: boolean;
}

const VOLUME_COPY = {
  under_10k: 'under 10,000',
  '10k_to_1m': '10,000 to 1 million',
  over_1m: 'over 1 million',
} as const;

/**
 * One opening line per role, and the compiler keeps it that way: the lookup below is indexed
 * by `Profile['role']`, so adding a role to `PROFILE_FIELDS` without a line here fails the
 * type check rather than rendering `undefined`.
 *
 * Six is the number of steps the checklist actually has. Every line says the same true thing
 * from the angle that role cares about.
 */
const ROLE_INTRO = {
  developer: 'Six steps from an API key to your first paid call.',
  founder: 'Six steps from an account to your first paid call.',
  product: 'Six steps from an account to a priced, published endpoint.',
  marketing: 'Six steps to an endpoint you can put in front of people.',
  sales: 'Six steps to something you can demo and quote a price for.',
  ops: 'Six steps from an account to your first settlement.',
  data: 'Six steps to an endpoint reporting requests, latency and revenue.',
  finance: 'Six steps from an account to a payout address that settles.',
  student: 'Six steps from an account to your first paid call.',
  other: 'Six steps from an account to your first paid call.',
} as const;

export default function Start() {
  const { user, publisher, signedIn, loading, openSignIn, refresh } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!publisher) return;
    let live = true;
    Promise.all([apiClient.getDashboard(publisher.id), apiClient.getWallet(publisher.id)])
      .then(([stats, wallet]) => {
        if (!live) return;
        setProgress({
          endpoints: stats.endpoints?.length ?? 0,
          paidCalls: stats.transactions?.length ?? 0,
          hasWallet: Boolean(wallet),
        });
        setError(null);
      })
      .catch((e: unknown) => live && setError(errorMessage(e, 'Could not check your progress.')));
    return () => {
      live = false;
    };
  }, [publisher, attempt]);

  const register = async () => {
    setRegistering(true);
    setError(null);
    try {
      const name = user?.email ? user.email.split('@')[0] : 'My Publisher';
      const created = await apiClient.registerPublisher({ name });
      if (!created.api_key || !created.id) throw new Error('Server returned no key');
      setApiKey(created.api_key);
      setPublisherId(created.id);
      await refresh();
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not create the publisher account.'));
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return null;

  if (!signedIn) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <p className="text-sm text-muted mb-4">Sign in to set up your publisher account.</p>
        <Button variant="primary" onClick={openSignIn}>
          Sign in
        </Button>
      </Card>
    );
  }

  const profile = user?.profile ?? {};
  const settings = publisher ? `/dashboard/${publisher.id}/settings` : '';
  // true = done, false = not yet, null = the backend has not answered.
  const known = (value: boolean | undefined) => (publisher ? (value ?? null) : false);

  const steps = [
    {
      key: 'register',
      title: 'Create your publisher account',
      done: Boolean(publisher),
      todo: 'No publisher account yet.',
      action: publisher ? null : (
        <Button size="sm" variant="primary" isLoading={registering} onClick={register}>
          Create account
        </Button>
      ),
    },
    {
      key: 'key',
      title: 'Get your API key',
      done: Boolean(publisher),
      todo: 'The key is issued with your publisher account.',
      action: publisher ? <LinkButton href={settings} label="Reveal and copy" /> : null,
    },
    {
      key: 'gateway',
      title: 'Note your gateway URL',
      done: Boolean(publisher),
      todo: 'Shown in Settings once you have an account.',
      action: publisher ? <LinkButton href={settings} label="Open settings" /> : null,
    },
    {
      key: 'api',
      title: 'Add your API from an OpenAPI file',
      done: known(progress ? progress.endpoints > 0 : undefined),
      todo: profile.volume
        ? `No endpoints yet. You expect ${VOLUME_COPY[profile.volume]} calls a month; you set the price per call in this step.`
        : 'No endpoints yet. You set the price per call in this step.',
      action: <LinkButton href="/onboarding" label="Add an API" />,
    },
    {
      key: 'wallet',
      title: 'Set your payout wallet',
      done: known(progress?.hasWallet),
      todo: 'No payout wallet yet. Payouts go to a testnet USDC wallet you control.',
      action: <LinkButton href="/onboarding" label="Set wallet" />,
    },
    {
      key: 'test',
      title: 'Make one paid test call',
      done: known(progress ? progress.paidCalls > 0 : undefined),
      todo: 'No paid call yet.',
      action: publisher ? (
        <LinkButton href={`/dashboard/${publisher.id}`} label="Open dashboard" />
      ) : null,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto mt-8 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-main mb-1">Set up as a provider</h1>
        <p className="text-sm text-muted">
          {ROLE_INTRO[profile.role ?? 'founder']} Each step shows what the backend has recorded.{' '}
          <button
            type="button"
            className="underline cursor-pointer"
            onClick={() => router.push('/welcome')}
          >
            Change your answers
          </button>
        </p>
      </div>

      {error && (
        <Card>
          <p className="text-sm text-error mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setAttempt(n => n + 1)}>
            Try again
          </Button>
        </Card>
      )}

      {steps.map((step, i) => (
        <Card key={step.key}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-main">
                {i + 1}. {step.title}
              </h2>
              {step.done === null && !error ? (
                <Skeleton width={180} className="mt-2" />
              ) : (
                <p className="text-xs text-muted mt-1">
                  {step.done ? 'Done.' : step.done === null ? 'Could not check.' : step.todo}
                </p>
              )}
            </div>
            {step.action}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Button size="sm" variant="secondary" onClick={() => router.push(href)}>
      {label}
    </Button>
  );
}
