'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sun, Moon, Box, Search, Shield } from 'lucide-react';
import AccountChip from '../../auth/AccountChip';
import { useAuth } from '../../auth/AuthContext';
import { getPublisherId } from '../../api/client';
import { consoleFallback, useConsoleView } from '../../lib/consoleView';
import { applyStoredTheme, useTheme } from '../../lib/theme';
import { Logo } from '../common/Logo';

/**
 * Screens with one job: sign in, answer the setup questions.
 *
 * They carry their own logo and no nav, so the header stands down and the layout drops the
 * offset that exists only to clear it. Exported so both decisions read the same list.
 */
export const isBareRoute = (pathname: string | null): boolean =>
  pathname === '/login' || pathname === '/welcome';

const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signedIn, publisher } = useAuth();
  const { view, choose } = useConsoleView(consoleFallback(user?.profile?.intent));
  const { theme, choose: chooseTheme } = useTheme();

  // The stored theme has to reach the document once per load. The hook reads the value; this
  // paints it, and it is idempotent, so a second header would not fight the first.
  useEffect(applyStoredTheme, []);

  const isDashboard = Boolean(pathname?.startsWith('/dashboard'));
  // Half the sidebar is the offset that puts the nav over the middle of the content rather
  // than the middle of the window. Both read `--sidebar-w`, so changing the column's width
  // moves the nav with it. Only from `lg`, because below that there is not enough room for an
  // absolutely placed nav to clear the logo.
  const navCentre = isDashboard ? 'lg:left-[calc(50%+var(--sidebar-w)/2)]' : '';

  const openDashboard = () => {
    // The console is gated, so send a signed-out visitor to the sign-in page rather than
    // opening a modal over a page they cannot use.
    if (!signedIn) {
      router.push('/login?next=%2Fdashboard');
      return;
    }
    const pubId = publisher?.id || getPublisherId();
    router.push(pubId ? `/dashboard/${pubId}` : '/dashboard/active');
  };

  if (isBareRoute(pathname)) return null;

  const pill = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium cursor-pointer border ${
      active
        ? 'border-border bg-panel text-main'
        : 'border-transparent bg-transparent text-muted hover:text-main'
    }`;

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-bg/80 backdrop-blur-md border-b border-border z-50">
      <div className="relative flex h-full items-center justify-between gap-4 px-4 sm:px-6">
        <div
          onClick={() => router.push('/')}
          className="flex cursor-pointer items-center gap-[7px] text-inherit"
        >
          <Logo size={34} className="text-accent" title="Spigot" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-main sm:inline">
            Spigot
          </span>
        </div>

        {/* Two consoles, so two controls. A third `Dashboard` pill sat here and only told you
            where you already were, which is what the active state already says. */}
        <nav
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-xl border border-border bg-panel/40 p-1 ${navCentre}`}
        >
          <button
            type="button"
            onClick={() => {
              choose('caller');
              openDashboard();
            }}
            aria-pressed={view === 'caller'}
            className={pill(view === 'caller')}
          >
            <Search size={16} />
            <span className="hidden sm:inline">Use APIs</span>
          </button>
          <button
            type="button"
            onClick={() => {
              choose('provider');
              openDashboard();
            }}
            aria-pressed={view === 'provider'}
            className={pill(view === 'provider')}
          >
            <Box size={16} />
            <span className="hidden sm:inline">My APIs</span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent text-muted hover:bg-panel hover:text-main"
            onClick={() => chooseTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                pathname === '/admin'
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
              title="Open Admin Console"
            >
              <Shield size={13} />
              <span>Admin</span>
            </button>
          )}
          <AccountChip />
        </div>
      </div>
    </header>
  );
};

export default Header;
