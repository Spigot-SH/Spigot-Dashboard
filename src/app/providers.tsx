'use client';

import { WalletProvider } from '@txnlab/use-wallet-react';
import { walletManager } from '../wallet/walletManager';
import { AuthProvider } from '../auth/AuthContext';
import SignInModal from '../auth/SignInModal';
import Header from '../components/layout/Header';
import { ToastProvider } from '../components/common/Toast';
import { WelcomeGate } from '../views/Welcome';

/**
 * The old App.tsx, minus routing.
 *
 * Everything here is client-only by necessity: WalletProvider reaches for window and
 * IndexedDB (Pera/Defly), and AuthProvider reads the session over a credentialed fetch.
 * Keeping it in one boundary means individual pages do not each have to re-declare it.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider manager={walletManager}>
      <AuthProvider>
        {/* Outside the layout div so the toast region is a sibling of the page, not a child
            of a column that could clip or offset it. */}
        <ToastProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex flex-col pt-20 px-6 pb-8">{children}</main>
            <SignInModal />
            <WelcomeGate />
          </div>
        </ToastProvider>
      </AuthProvider>
    </WalletProvider>
  );
}
