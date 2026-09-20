'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/common/Button';
import { authApi, type Profile } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/errors';

/**
 * Three screens, one question each, every answer a click.
 *
 * Field names and values must match PROFILE_FIELDS in
 * Spigot-Algorand/backend/src/services/session.ts — the backend keeps known values and drops
 * everything else, so an answer it does not recognise is silently lost. That is also why there
 * is no free-text question here: a value the backend has not been taught is not saved.
 *
 * `intent` is the one that matters — it picks which console a person lands in. The other two
 * are optional colour. `payout` is no longer asked; the wallet step says the same thing in
 * place, at the point where it is actually needed.
 */
const SCREENS = [
  {
    field: 'intent',
    title: 'What brings you here?',
    hint: 'Choose your Console below (you can switch later)',
    options: [
      ['sell', 'Sell my API', 'Publish an endpoint and get paid per request.'],
      ['call', 'Call APIs', 'Buy credit once, then call anything you have a link to.'],
      ['both', 'Both', 'Start wherever. The console has a switch for the other one.'],
    ],
  },
  {
    field: 'role',
    title: 'What is your role?',
    hint: 'Changes the opening line of your setup checklist.',
    options: [
      ['developer', 'Developer', 'You will be the one wiring up the endpoint.'],
      ['founder', 'Founder', 'You want it live and earning.'],
      ['product', 'Product', 'You decide what ships and what it costs.'],
      ['marketing', 'Marketing', 'You want the API found and tried.'],
      ['sales', 'Sales', 'You take it to customers and quote it.'],
      ['ops', 'Operations', 'You care about uptime and settlement.'],
      ['data', 'Data', 'You are here for the numbers behind the calls.'],
      ['finance', 'Finance', 'You follow the money in and the payouts out.'],
      ['student', 'Student or hobbyist', 'You are building something for yourself.'],
      ['other', 'Something else', 'None of the above fits.'],
    ],
  },
  {
    field: 'volume',
    title: 'How many calls a month do you expect?',
    hint: 'Shown next to the pricing step. It does not set a price.',
    options: [
      ['under_10k', 'Under 10,000', 'A side project or an early product.'],
      ['10k_to_1m', '10,000 to 1 million', 'A product with real traffic.'],
      ['over_1m', 'Over 1 million', 'High volume. Worth talking about pricing.'],
    ],
  },
] as const;

export default function Welcome() {
  const { user, signedIn, loading, refresh, signOut } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
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
      router.replace('/dashboard');
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not save your answers.'));
      setSaving(false);
    }
  };

  // Saving with nothing picked is a skip. An empty profile would send the user back here.
  const finish = () => save(Object.keys(answers).length ? answers : { skipped: true });

  if (loading || !signedIn) return null;

  const screen = SCREENS[step];
  const picked = answers[screen.field];
  const last = step === SCREENS.length - 1;
  // Ten options in one column runs off the screen; three in two columns leaves an odd gap.
  // The list decides, so a screen that grows or shrinks lays itself out without another edit.
  const twoUp = screen.options.length > 4;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className={`w-full ${twoUp ? 'max-w-[680px]' : 'max-w-[420px]'}`}>
        <p className="mb-6 text-center text-xs uppercase tracking-wider text-muted">
          Step {step + 1} of {SCREENS.length}
        </p>

        <h1 className="mb-1 text-center text-2xl font-semibold text-main">{screen.title}</h1>
        <p className="mb-6 text-center text-sm text-muted">{screen.hint}</p>

        {/* One column on a phone either way: two columns of this at 360px would be unreadable. */}
        <div className={`grid gap-2 ${twoUp ? 'sm:grid-cols-2' : ''}`}>
          {screen.options.map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              aria-pressed={picked === value}
              // Tapping the chosen one clears it. Every question here is optional, so there
              // has to be a way back to having said nothing.
              onClick={() =>
                setAnswers(a => ({ ...a, [screen.field]: picked === value ? undefined : value }))
              }
              className={`cursor-pointer rounded-lg border p-4 text-left ${
                picked === value
                  ? 'border-main bg-main'
                  : 'border-border bg-panel hover:border-main hover:bg-panel-hover'
              }`}
            >
              <span
                className={`block text-sm font-medium ${picked === value ? 'text-bg' : 'text-main'}`}
              >
                {label}
              </span>
              <span
                className={`mt-0.5 block text-xs ${picked === value ? 'text-bg/70' : 'text-muted'}`}
              >
                {description}
              </span>
            </button>
          ))}
        </div>

        <div className={twoUp ? 'mx-auto max-w-[420px]' : ''}>
          <Button
            variant="primary"
            className="mt-6 w-full"
            isLoading={saving}
            disabled={!picked}
            onClick={() => (last ? finish() : setStep(s => s + 1))}
          >
            {last ? 'Go to my console' : 'Continue'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-error">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between text-xs text-muted">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep(s => s - 1)}
            className="cursor-pointer border-0 bg-transparent text-muted hover:text-main disabled:invisible"
          >
            Back
          </button>
          {/* The header is hidden on this screen, so without this there is no way to sign
              out of an account you did not mean to be in. */}
          <span className="truncate px-3">
            Signed in as {user?.email}.{' '}
            <button
              type="button"
              disabled={saving}
              onClick={() => void signOut()}
              className="cursor-pointer border-0 bg-transparent text-muted underline hover:text-main"
            >
              Sign out
            </button>
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ skipped: true })}
            className="shrink-0 cursor-pointer border-0 bg-transparent text-accent hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
