'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  BarChart3,
  Settings,
  Wallet,
  BookOpen,
  LifeBuoy,
  Compass,
  Bot,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface SidebarProps {
  publisherId: string;
  /** Which console is showing. The caller one has no APIs, analytics or publisher settings. */
  view?: 'provider' | 'caller';
}

const Sidebar: React.FC<SidebarProps> = ({ publisherId, view = 'provider' }) => {
  const pathname = usePathname();

  // `exact` reproduces react-router's `end` prop: Overview is a prefix of the other links, so
  // without it it would highlight on every sub-page.
  const overview = {
    name: 'Overview',
    path: `/dashboard/${publisherId}`,
    icon: LayoutDashboard,
    exact: true,
  };

  const exploreApis = {
    name: 'Explore APIs',
    path: `/dashboard/${publisherId}/explore`,
    icon: Compass,
    exact: false,
  };

  const connectors = {
    name: 'AI Connectors',
    path: `/dashboard/${publisherId}/connectors`,
    icon: Bot,
    exact: false,
  };

  const navItems =
    view === 'caller'
      ? [
          overview,
          exploreApis,
          connectors,
          { name: 'Account & credit', path: '/profile', icon: Wallet, exact: true },
          {
            name: 'Settings',
            path: `/dashboard/${publisherId}/settings`,
            icon: Settings,
            exact: false,
          },
        ]
      : [
          overview,
          { name: 'APIs', path: `/dashboard/${publisherId}/apis`, icon: Server, exact: false },
          exploreApis,
          connectors,
          {
            name: 'Analytics',
            path: `/dashboard/${publisherId}/analytics`,
            icon: BarChart3,
            exact: false,
          },
          {
            name: 'Settings',
            path: `/dashboard/${publisherId}/settings`,
            icon: Settings,
            exact: false,
          },
        ];

  const { user } = useAuth();

  const allNavItems = [...navItems];
  if (user?.isAdmin) {
    allNavItems.push({
      name: 'Admin Console',
      path: '/admin',
      icon: Shield,
      exact: false,
    });
  }

  return (
    // Below `md` the column is an icon rail. A fixed 240px column on a phone left the
    // content about 80px wide; hiding the nav outright would leave the console with no way
    // to move between sections at all.
    <aside className="sticky top-16 flex h-[calc(100vh-64px)] w-14 shrink-0 flex-col border-r border-border bg-bg py-4 md:w-[var(--sidebar-w)]">
      <p className="mb-2 hidden px-4 text-[0.7rem] font-medium uppercase tracking-wider text-muted md:block">
        {view === 'caller' ? 'Caller' : 'Developer'}
      </p>

      <nav className="flex flex-col">
        {allNavItems.map(item => {
          const isOverview = item.name === 'Overview';
          const isActive = isOverview
            ? pathname === item.path || pathname === '/dashboard'
            : item.exact
              ? pathname === item.path
              : Boolean(pathname?.startsWith(item.path));

          return (
            <Link
              key={item.name}
              href={item.path}
              // The highlight is a box inside the column, not a band across it: a margin on
              // both sides and a radius, so it reads as a selected item rather than a stripe.
              // `text-on-accent` is the token that stays legible on the fill in either theme.
              title={item.name}
              className={`mx-2 flex items-center justify-center gap-0 rounded-lg px-0 py-2.5 text-sm no-underline md:justify-start md:gap-3 md:px-3 ${
                isActive
                  ? 'bg-accent font-medium text-on-accent'
                  : 'text-muted hover:bg-panel-hover hover:text-main'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-on-accent' : 'text-muted'} />
              <span className="hidden md:inline">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Disabled until there is somewhere to send people. No docs or support URL exists in
          any of the five repos, and a link to a page that is not there is worse than a row
          that says so. */}
      <div className="mt-auto flex flex-col border-t border-border pt-4">
        {[
          { name: 'Documentation', icon: BookOpen },
          { name: 'Support', icon: LifeBuoy },
        ].map(item => (
          <button
            key={item.name}
            type="button"
            disabled
            title={`${item.name} is not published yet`}
            className="mx-2 flex items-center justify-center gap-0 rounded-lg border-0 bg-transparent px-0 py-2.5 text-left text-sm text-muted opacity-50 md:justify-start md:gap-3 md:px-3"
          >
            <item.icon size={18} />
            <span className="hidden md:inline">{item.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
