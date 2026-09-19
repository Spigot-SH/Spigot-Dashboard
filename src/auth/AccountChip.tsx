'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/common/Spinner';

const AccountChip: React.FC = () => {
  const { user, credits, loading, signedIn, openSignIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (loading) {
    return <Spinner size={16} className="text-muted" />;
  }

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="text-bg bg-main text-sm font-medium px-3.5 py-1.5 rounded-md border border-main cursor-pointer hover:opacity-90"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-panel border border-border rounded-md px-3 py-1.5 cursor-pointer hover:border-white/20"
      >
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 rounded-full"
            unoptimized
          />
        ) : (
          <User size={14} className="text-muted" />
        )}
        <span className="text-sm text-main max-w-[140px] truncate">{user?.email}</span>
        <span className="text-xs font-mono text-muted border-l border-border pl-2">
          {credits.toFixed(2)} USDC
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[260px] z-50 rounded-lg border border-border bg-panel p-3">
            <p className="text-xs text-muted m-0 mb-1">Signed in as</p>
            <p className="text-sm text-main m-0 mb-3 truncate">{user?.email}</p>

            <div className="text-xs border-t border-border pt-3 mb-3">
              <div className="flex justify-between">
                <span className="text-muted">Credit</span>
                <span className="font-mono text-main">{credits.toFixed(6)} USDC</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/profile');
              }}
              className="w-full text-left text-sm text-main bg-transparent border-0 cursor-pointer px-0 py-1.5 hover:opacity-70"
            >
              Account & credit
            </button>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full flex items-center gap-2 text-left text-sm text-main bg-transparent border-0 cursor-pointer px-0 py-1.5 hover:opacity-70"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountChip;
