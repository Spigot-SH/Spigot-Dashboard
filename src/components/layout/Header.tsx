'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Network, Sun, Moon, LayoutDashboard, Store, User } from 'lucide-react';
import AccountChip from '../../auth/AccountChip';
import { useAuth } from '../../auth/AuthContext';
import { getPublisherId } from '../../api/client';

const THEME_STORAGE_KEY = 'x402_theme';

const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { signedIn, publisher, openSignIn } = useAuth();
  // Starts at the server-rendered default and corrects in the effect below. Reading
  // localStorage during the initial render would not match the HTML Next sent.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // usePathname is typed nullable because it has no value during prerender.
  const isMarketplace = pathname === '/';
  const isDashboard = Boolean(pathname?.startsWith('/dashboard'));
  const isProfile = pathname === '/profile';

  const handleDashboardClick = () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    const pubId = publisher?.id || getPublisherId();
    if (pubId) {
      router.push(`/dashboard/${pubId}`);
    } else {
      router.push('/dashboard/active');
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-bg/80 backdrop-blur-md border-b border-border z-50">
      <div className="flex items-center justify-between h-full max-w-7xl mx-auto px-6">
        <div
          onClick={() => router.push('/')}
          className="flex items-center gap-3 text-inherit cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-panel border border-border flex items-center justify-center text-main group-hover:bg-panel-hover group-hover:border-white/20">
            <Network size={20} />
          </div>
          <span className="text-lg tracking-tight text-main">Spigot</span>
        </div>
        <nav className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className={`flex items-center gap-1.5 text-sm font-medium bg-transparent border-0 cursor-pointer p-0 ${
              isMarketplace ? 'text-main font-semibold' : 'text-muted hover:text-main'
            }`}
          >
            <Store size={15} />
            Marketplace
          </button>
          <button
            type="button"
            onClick={handleDashboardClick}
            className={`flex items-center gap-1.5 text-sm font-medium bg-transparent border-0 cursor-pointer p-0 ${
              isDashboard ? 'text-main font-semibold' : 'text-muted hover:text-main'
            }`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className={`flex items-center gap-1.5 text-sm font-medium bg-transparent border-0 cursor-pointer p-0 ${
              isProfile ? 'text-main font-semibold' : 'text-muted hover:text-main'
            }`}
          >
            <User size={15} />
            Profile
          </button>
          <button
            type="button"
            onClick={() => router.push('/start')}
            className="text-main hover:text-white text-sm font-medium bg-panel px-3 py-1.5 rounded-md border border-border hover:border-white/20 cursor-pointer"
          >
            Publish API
          </button>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent border border-border text-muted hover:text-main hover:bg-panel-hover cursor-pointer"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <AccountChip />
        </nav>
      </div>
    </header>
  );
};

export default Header;
