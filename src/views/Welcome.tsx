'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { authApi, type Profile } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/errors';

/**
 * Each question says what its answer changes. Values must match PROFILE_FIELDS in
 * Spigot-Algorand/backend/src/services/session.ts: the backend drops anything else.
 */
const QUESTIONS = [
  {
    field: 'intent',
    title: 'What brings you here?',
    changes: 'Decides where you land after this form.',
    options: [
      ['sell', 'Sell my API'],
      ['call', 'Call APIs'],
      ['both', 'Both'],
    ],
  },
  {
    field: 'role',
    title: 'What is your role?',
    changes: 'Changes the opening line of your setup checklist.',
    options: [
      ['developer', 'Developer'],
      ['founder', 'Founder'],
      ['ops', 'Operations'],
    ],
  },
  {
    field: 'volume',
    title: 'How many calls a month do you expect?',
    changes: 'Shown next to the pricing step. It does not set a price.',
    options: [
      ['under_10k', 'Under 10,000'],
      ['10k_to_1m', '10,000 to 1 million'],
      ['over_1m', 'Over 1 million'],
    ],
  },
  {
    field: 'payout',
    title: 'Do you need payouts yet?',
    changes: 'Moves the payout wallet step to the top of your checklist.',
    options: [
      ['none', 'Not yet'],
      ['wallet', 'Yes, to a testnet USDC wallet'],
    ],
  },
] as const;

/** Sends a signed-in user with no saved answers to the form, once. Skipping counts as an answer. */
export function WelcomeGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // An older backend sends no profile at all. Do nothing then, or this would loop.
    if (loading || !user?.profile || pathname === '/welcome') return;
    if (Object.keys(user.profile).length === 0) router.replace('/welcome');
  }, [loading, user, pathname, router]);

  return null;
}

export default function Welcome() {
  const { user, signedIn, loading, openSignIn, refresh } = useAuth();
  const router = useRouter();
  const [answers, setAnswers] = useState<Profile>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.profile) setAnswers(user.profile);
  }, [user]);

  const save = async (profile: Profile) => {
    setSaving(true);
    setError(null);
    try {
      await authApi.updateProfile(profile);
      await refresh();
      router.push(profile.skipped || profile.intent === 'call' ? '/' : '/start');
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not save your answers.'));
      setSaving(false);
    }
  };

  if (loading) return null;

  if (!signedIn) {
    return (
      <Card className="max-w-xl mx-auto mt-8">
        <p className="text-sm text-muted mb-4">
          Sign in first. Your answers are saved on your account.
        </p>
        <Button variant="primary" onClick={openSignIn}>
          Sign in
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-main mb-1">Four quick questions</h1>
        <p className="text-sm text-muted">
          Every question is optional. Your answers are saved on your account. You can change them
          later from the provider setup page.
        </p>
      </div>

      {QUESTIONS.map(q => (
        <Card key={q.field}>
          <h2 className="text-sm font-medium text-main">{q.title}</h2>
          <p className="text-xs text-muted mb-3">{q.changes}</p>
          <div className="flex flex-wrap gap-2">
            {q.options.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={answers[q.field] === value ? 'primary' : 'secondary'}
                aria-pressed={answers[q.field] === value}
                onClick={() => setAnswers(a => ({ ...a, [q.field]: value }))}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      ))}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        {/* Saving with nothing picked is a skip. An empty profile would send the user back here. */}
        <Button
          variant="primary"
          isLoading={saving}
          onClick={() => save(Object.keys(answers).length ? answers : { skipped: true })}
        >
          Save and continue
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => save({ skipped: true })}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
