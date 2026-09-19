'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Server, BarChart3, Settings, Store } from 'lucide-react';

interface SidebarProps {
  publisherId: string;
}

const Sidebar: React.FC<SidebarProps> = ({ publisherId }) => {
  const pathname = usePathname();

  const navItems = [
    // `exact` reproduces react-router's `end` prop: Overview and Marketplace are prefixes of
    // the other links, so without it they would both highlight on every sub-page.
    { name: 'Overview', path: `/dashboard/${publisherId}`, icon: LayoutDashboard, exact: true },
    { name: 'APIs', path: `/dashboard/${publisherId}/apis`, icon: Server, exact: false },
    {
      name: 'Analytics',
      path: `/dashboard/${publisherId}/analytics`,
      icon: BarChart3,
      exact: false,
    },
    { name: 'Settings', path: `/dashboard/${publisherId}/settings`, icon: Settings, exact: false },
    { name: 'Marketplace', path: '/', icon: Store, exact: true },
  ];

  return (
    <aside className="w-64 bg-bg border-r border-border sticky top-16 h-[calc(100vh-64px)] flex flex-col py-6 px-4">
      <nav className="flex flex-col gap-1">
        {navItems.map(item => {
          // usePathname is typed nullable because it has no value during prerender.
          const isActive = item.exact
            ? pathname === item.path
            : Boolean(pathname?.startsWith(item.path));

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm no-underline ${
                isActive
                  ? 'bg-panel text-main font-medium'
                  : 'text-muted hover:bg-panel-hover hover:text-main'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-main' : 'text-muted'} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
