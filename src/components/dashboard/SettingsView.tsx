'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, getApiKey, getPublisherId, setApiKey, setPublisherId } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../common/Button';
import { errorMessage } from '../../lib/errors';
import {
  ArrowLeft,
  Banknote,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Search,
  SlidersHorizontal,
  Terminal,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { Select } from '../common/Select';
import { consoleFallback, useConsoleView } from '../../lib/consoleView';
import { useTheme } from '../../lib/theme';

interface SettingsViewProps {
  publisherId: string;
}

type SectionId = 'general' | 'account' | 'key' | 'payout' | 'developer';

const SECTIONS: { group: string; items: { id: SectionId; name: string; icon: typeof User }[] }[] = [
  {
    group: 'Set up',
    items: [
      { id: 'general', name: 'General', icon: SlidersHorizontal },
      { id: 'account', name: 'Profile', icon: User },
    ],
  },
  {
    group: 'Money',
    items: [{ id: 'payout', name: 'Payout', icon: Banknote }],
  },
  {
    group: 'Developer',
    items: [
      { id: 'key', name: 'API key', icon: KeyRound },
      { id: 'developer', name: 'Gateway', icon: Terminal },
    ],
  },
];

/** Label left with its explanation, control right. The row shape the whole page is built from. */
const Row: React.FC<{ label: string; hint?: string; children?: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 last:border-0">
    <div className="min-w-0">
      <p className="m-0 text-sm font-medium text-main">{label}</p>
      {hint && <p className="m-0 mt-1 max-w-md text-xs text-muted">{hint}</p>}
    </div>
    {children}
  </div>
);

/**
 * A named run of rows inside one pane.
 *
 * A settings page is rarely one flat list. Grouping is what lets a pane hold more than one
 * subject without becoming a wall, and the heading is the thing a person scans for.
 */
const Group: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className="border-b border-border py-5 last:border-0">
    <h3 className="m-0 text-sm font-semibold text-main">{title}</h3>
    {hint && <p className="m-0 mt-1 text-xs text-muted">{hint}</p>}
    <div className="mt-1">{children}</div>
  </div>
);

const Pane: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section>
    <h2 className="text-xl font-semibold text-main">{title}</h2>
    <p className="mt-1 text-sm text-muted">{hint}</p>
    <div className="mt-6 rounded-xl border border-border bg-panel px-5">{children}</div>
  </section>
);

/**
 * Publisher settings, as a settings app rather than a stack of cards.
 *
 * What is deliberately absent: the network name, the USDC asset id and the description of
 * settlement as atomic transaction groups. A publisher picks a chain when they choose where
 * payouts land, and nowhere else, so that is the only place any of it appears. The rest is
 * infrastructure and stays behind the product.
 */
export const SettingsView: React.FC<SettingsViewProps> = ({ publisherId }) => {
  const { user, publisher, refresh } = useAuth();
  const { view, choose } = useConsoleView(consoleFallback(user?.profile?.intent));
  const { theme, choose: chooseTheme } = useTheme();
  const [active, setActive] = useState<SectionId>('general');
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [payout, setPayout] = useState<{ address?: string } | null | 'loading' | 'error'>(
    'loading',
  );

  const currentApiKey = apiKey || publisher?.api_key;
  const effectivePubId = publisher?.id || getPublisherId() || publisherId || 'active';
  const gatewayUrl =
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://spigot.sh');

  useEffect(() => {
    if (!publisher?.id) return;
    let live = true;
    apiClient
      .getWallet(publisher.id)
      .then(w => live && setPayout(w))
      .catch(() => live && setPayout('error'));
    return () => {
      live = false;
    };
  }, [publisher?.id]);

  /**
   * Command-F focuses the filter rather than opening the browser's find bar.
   *
   * Only while this page is mounted, and only for the combination the sidebar advertises. A
   * page that prints a shortcut and does not honour it is worse than printing nothing.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'f' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      search.current?.focus();
      search.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const name = user?.email ? user.email.split('@')[0] : 'My Publisher';
      const result = await apiClient.registerPublisher({ name });
      if (!result.api_key || !result.id) throw new Error('Server returned no key');
      setApiKey(result.api_key);
      setPublisherId(result.id);
      setApiKeyState(result.api_key);
      await refresh();
    } catch (e: unknown) {
      setGenError(errorMessage(e, 'Could not generate a key'));
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map(s => ({
      ...s,
      items: s.items.filter(
        i => i.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q),
      ),
    })).filter(s => s.items.length > 0);
  }, [query]);

  const iconButton =
    'rounded-md p-2 text-muted hover:bg-panel-hover hover:text-main cursor-pointer border-0 bg-transparent';

  // Rendered after hydration only. `navigator` does not exist on the server, and a chip that
  // says the wrong key is worse than one that arrives a frame late.
  const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <nav className="w-full shrink-0 lg:w-56">
        <Link
          href={publisher?.id ? `/dashboard/${publisher.id}` : '/dashboard'}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-main"
        >
          <ArrowLeft size={15} /> Back to the console
        </Link>

        <div className="relative mb-4">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="w-full rounded-lg border border-border bg-panel py-2 pl-9 pr-16 text-sm text-main outline-none focus:border-main"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 gap-1"
          >
            <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[0.65rem] text-muted">
              {mod}
            </kbd>
            <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[0.65rem] text-muted">
              F
            </kbd>
          </span>
        </div>

        {filtered.map(section => (
          <div key={section.group} className="mb-4">
            <p className="mb-1 px-2 text-[0.7rem] font-medium uppercase tracking-wider text-muted">
              {section.group}
            </p>
            {section.items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg border-0 px-2.5 py-2 text-left text-sm cursor-pointer ${
                  active === item.id
                    ? 'bg-accent font-medium text-on-accent'
                    : 'bg-transparent text-muted hover:bg-panel-hover hover:text-main'
                }`}
              >
                <item.icon size={16} />
                {item.name}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="px-2 text-xs text-muted">Nothing matches.</p>}
      </nav>

      <div className="min-w-0 flex-1 max-w-3xl">
        {active === 'general' && (
          <Pane title="General" hint="How the console looks and where it opens.">
            <Group title="Appearance">
              <Row label="Theme" hint="Applies to this browser only.">
                {/* `Select` sets `w-full` on itself, so a width passed through `className`
                    loses to it. The width belongs to the slot, not the control. */}
                <div className="w-44">
                  <Select
                    value={theme}
                    onChange={e => chooseTheme(e.target.value as 'dark' | 'light')}
                    aria-label="Theme"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </Select>
                </div>
              </Row>
            </Group>

            <Group
              title="Navigation"
              hint="The console you land in. The header switches it too; this is the same setting."
            >
              <Row label="Console" hint="Calling needs no publisher account. Publishing does.">
                <div className="w-44">
                  <Select
                    value={view}
                    onChange={e => choose(e.target.value as 'caller' | 'provider')}
                    aria-label="Console"
                  >
                    <option value="caller">Calling</option>
                    <option value="provider">Publishing</option>
                  </Select>
                </div>
              </Row>
            </Group>
          </Pane>
        )}

        {active === 'account' && (
          <Pane title="Profile" hint="Who your callers see, and where we reach you.">
            <Row label="Publisher name">
              <span className="text-sm text-main">
                {publisher?.name || user?.email?.split('@')[0] || 'Not set'}
              </span>
            </Row>
            <Row label="Contact email" hint="The address you signed in with.">
              <span className="font-mono text-sm text-main">{user?.email || 'Not set'}</span>
            </Row>
            <Row label="Publisher ID" hint="Quote this if you ask us about your account.">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs text-muted">
                  {effectivePubId}
                </span>
                <button
                  type="button"
                  onClick={() => copy('pub', effectivePubId)}
                  className={iconButton}
                  title="Copy publisher ID"
                >
                  {copied === 'pub' ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </Row>
          </Pane>
        )}

        {active === 'payout' && (
          <Pane title="Payout" hint="Where your earnings go when you withdraw.">
            <Row
              label="To my wallet"
              hint={
                payout === 'loading'
                  ? 'Checking where your payouts go.'
                  : payout === 'error'
                    ? 'Could not check your payout destination.'
                    : payout?.address
                      ? `Currently ${payout.address.slice(0, 10)}…${payout.address.slice(-6)}`
                      : 'No destination set yet. You choose one when you publish an API.'
              }
            >
              <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">
                Available
              </span>
            </Row>
            <Row
              label="To my bank"
              hint="Take earnings as cash instead. Not available yet; wallet payout works today."
            >
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                Coming
              </span>
            </Row>
          </Pane>
        )}

        {active === 'key' && (
          <Pane title="API key" hint="Used by the Spigot CLI and SDKs to manage your endpoints.">
            <Row label="Secret key" hint="Treat it like a password. Anyone holding it acts as you.">
              {currentApiKey ? (
                <div className="flex items-center gap-2">
                  <span className="max-w-[220px] truncate rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs text-main">
                    {showKey ? currentApiKey : '••••••••••••••••••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className={iconButton}
                    title={showKey ? 'Hide key' : 'Reveal key'}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy('key', currentApiKey)}
                    className={iconButton}
                    title="Copy key"
                  >
                    {copied === 'key' ? (
                      <Check size={15} className="text-success" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                </div>
              ) : (
                <Button size="sm" isLoading={generating} onClick={generate}>
                  Generate key
                </Button>
              )}
            </Row>
            {genError && (
              <Row label="">
                <p role="alert" className="m-0 text-sm text-error">
                  {genError}
                </p>
              </Row>
            )}
          </Pane>
        )}

        {active === 'developer' && (
          <Pane title="Gateway" hint="The origin your callers send requests to.">
            <Row label="Gateway origin" hint="Your endpoints are served from under this address.">
              <div className="flex items-center gap-2">
                <span className="max-w-[260px] truncate rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs text-muted">
                  {gatewayUrl}/x402
                </span>
                <button
                  type="button"
                  onClick={() => copy('gw', `${gatewayUrl}/x402`)}
                  className={iconButton}
                  title="Copy gateway origin"
                >
                  {copied === 'gw' ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </Row>
          </Pane>
        )}
      </div>
    </div>
  );
};
