'use client';

import { usePathname } from 'next/navigation';

import { WalletProvider } from '@txnlab/use-wallet-react';
import { walletManager } from '../wallet/walletManager';
import { AuthProvider } from '../auth/AuthContext';
import SignInModal from '../auth/SignInModal';
import ConsoleGate from '../auth/ConsoleGate';
import Header, { isBareRoute } from '../components/layout/Header';
import { ToastProvider } from '../components/common/Toast';

/**
 * The old App.tsx, minus routing.
 *
 * Everything here is client-only by necessity: WalletProvider reaches for window and
 * IndexedDB (Pera/Defly), and AuthProvider reads the session over a credentialed fetch.
 * Keeping it in one boundary means individual pages do not each have to re-declare it.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  // The header is fixed, so the main column pads past it. A screen with no header has no
  // header to clear, and `/login` runs edge to edge, so each bare screen sets its own gutter.
  const pathname = usePathname();
  const bare = isBareRoute(pathname);
  // The console owns its own gutters: the sidebar runs to the window edge and the header nav
  // centres on the content beside it. A gutter here would push both off by its own width.
  const console_ = Boolean(pathname?.startsWith('/dashboard'));

  return (
    <WalletProvider manager={walletManager}>
      <AuthProvider>
        {/* Outside the layout div so the toast region is a sibling of the page, not a child
            of a column that could clip or offset it. */}
        <ToastProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main
              className={`flex flex-1 flex-col ${bare ? '' : console_ ? 'pt-16' : 'px-6 pb-8 pt-20'}`}
            >
              <ConsoleGate>{children}</ConsoleGate>
            </main>
            <SignInModal />
          </div>
        </ToastProvider>
      </AuthProvider>
    </WalletProvider>
  );
}
