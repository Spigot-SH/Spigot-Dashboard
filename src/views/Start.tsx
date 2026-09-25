'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { apiClient, setPublisherId } from '../api/client';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/errors';
import { ProviderAccessLockedCard } from '../components/dashboard/ProviderAccessLockedCard';
import { runProviderAccessRequestFlow } from './providerAccessFlow';
import { deriveKeyIssuedState } from '../lib/apiKeyRotation';

/** What the backend says about this publisher. null means the check has not answered yet. */
interface Progress {
  endpoints: number;
  paidCalls: number;
  hasWallet: boolean;
  /** The rotation version apiClient.getPublisherKeyInfo reports — null means no key has ever
   * actually been issued to this publisher (registration's own key is never shown). The actual
   * field the rotation contract checks (Codex round-3, f20m/f20dr3): unlike apiKeyRotatedAt's
   * millisecond-resolution timestamp, this integer counter cannot collide between two rotations. */
  apiKeyVersion: number | null;
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
  const { user, publisher, providerAccess, signedIn, loading, openSignIn, refresh } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);

  // The provider side is coming soon: every step below either registers a publisher or reads
  // its dashboard, and the backend now refuses both for an account that is not
  // provider-approved. An already-existing publisher (grandfathered, or approved then
  // revoked) still tries the checklist — its own requests surface the current 403 as `error`.
  const isProviderAccessBlocked = !loading && !publisher && providerAccess !== 'approved';

  const handleRequestProviderAccess = async () => {
    setIsRequestingAccess(true);
    try {
      await runProviderAccessRequestFlow(authApi.requestProviderAccess, refresh);
    } finally {
      setIsRequestingAccess(false);
    }
  };

  useEffect(() => {
    // Reset immediately, before the fetch below even starts — not only when there is no
    // publisher. Without this, switching to a *different* publisher (this same signed-in
    // account, or a different one) while progress from the previous one is still in state would
    // render that stale progress under the new publisher's identity for every render between
    // this effect starting and its own fetch resolving (Codex round-3 rejection, f20dr3: "clear
    // progress when the publisher changes"). A failed check (the catch below) also leaves
    // `error` set with `progress` cleared, rather than stale data silently standing in.
    setProgress(null);
    if (!publisher) return;
    let live = true;
    Promise.all([
      apiClient.getDashboard(publisher.id),
      apiClient.getWallet(publisher.id),
      // The read-only rotation version — null when no key has ever actually been issued to this
      // publisher, distinct from a publisher row always carrying registration's never-shown
      // placeholder key. A failed check here must not silently read as "done": if this call
      // fails while the other two succeed, the whole Promise.all rejects and the catch below
      // sets `error`, which is what makes every step render "Could not check." rather than a
      // guessed answer for just this one.
      apiClient.getPublisherKeyInfo(publisher.id),
    ])
      .then(([stats, wallet, keyInfo]) => {
        if (!live) return;
        setProgress({
          endpoints: stats.endpoints?.length ?? 0,
          paidCalls: stats.transactions?.length ?? 0,
          hasWallet: Boolean(wallet),
          apiKeyVersion: keyInfo.apiKeyVersion,
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
      // apiClient.registerPublisher already rejects a malformed body (missing/non-string id)
      // and throws, so `created.id` here is guaranteed a valid string.
      const created = await apiClient.registerPublisher({ name });
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

  if (isProviderAccessBlocked) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <ProviderAccessLockedCard
          providerAccess={providerAccess}
          onRequestAccess={handleRequestProviderAccess}
          isRequesting={isRequestingAccess}
        />
      </div>
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
      // Done only once the backend confirms a key was actually issued (apiKeyVersion, from
      // POST /publishers/:id/api-key) — registration mints a row but never hands out a usable
      // key, so `Boolean(publisher)` alone read this step Done for a publisher that had never
      // gotten one. Unknown (null) until that check comes back, the same as the steps below.
      //
      // Does not separately distinguish "a legacy row whose pre-step-up key still works" from
      // "never issued" (Codex round-3 rejection, f20dr3) because that distinction no longer
      // exists to make: the backend's boot migration (Spigot-Algorand db/migrations.ts,
      // revokeUnversionedPublisherKeys) force-rotates every publisher key that predates
      // apiKeyVersion tracking onto a fresh, never-shown value — the same "no key has ever
      // actually been issued" state a brand-new registration is already in. `apiKeyVersion:
      // null` is therefore unambiguous everywhere: not done, full stop; there is no third,
      // "possibly still usable" case left for this step to render.
      done: deriveKeyIssuedState(Boolean(publisher), progress?.apiKeyVersion),
      todo: 'Issuing a key needs an emailed confirmation code, from Settings.',
      // No key is ever handed out here or at registration — it needs the emailed step-up
      // code, which the key pane in Settings runs. "Reveal and copy" promised a key that
      // registration no longer returns, so this links straight to the pane that gets one.
      action: publisher ? <LinkButton href={`${settings}#key`} label="Get your key" /> : null,
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
      // Settings, not `/onboarding`: the wizard only reaches a wallet field at step 6, behind
      // five steps including domain verification, so this link used to ask for a whole API
      // to set one address.
      action: publisher ? <LinkButton href={`${settings}#payout`} label="Set wallet" /> : null,
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
