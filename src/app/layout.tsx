import type { Metadata } from 'next';
import Script from 'next/script';
import { Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import Providers from './providers';
import { MAGIC_LINK_FRAGMENT_STASH_KEY } from '../lib/magicLinkFlow';
import '../styles/index.css';

/**
 * Self-hosted by Next at build time, replacing the two <link rel="preconnect"> tags and the
 * blocking stylesheet the old index.html pulled from fonts.googleapis.com. Same families,
 * same weights — no render-blocking third-party request.
 */
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-schibsted',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://spigot.sh'),
  title: {
    default: 'Spigot: APIs, metered per call',
    template: '%s · Spigot',
  },
  description: 'Publish an API and get paid per request. No subscription, no signup for callers.',
  openGraph: {
    siteName: 'Spigot',
    type: 'website',
    url: 'https://spigot.sh',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/*
          Moves `#token=...&email=...` out of the URL and into sessionStorage before any other
          script on the page runs — including the ones `Providers` below mounts (WalletProvider,
          and Firebase, which `lib/firebase.ts` initializes as soon as its module loads).
          `strategy="beforeInteractive"` is Next's own guarantee for exactly this: it inlines
          the script into the HTML response and runs it before hydration and before any other
          Next-managed script, so nothing gets a chance to read the fragment first. This is the
          simplest option that actually runs first — no SDK config to audit, no per-route
          opt-out to keep in sync as routes change; it is also gated to `/login/magic-link` by
          the check inside it, so every other route is untouched.
          MagicLinkCallback.tsx reads the stash and falls back to a live `location.hash` only if
          this script did not run (e.g. a cached HTML shell from before this change).
        */}
        <Script id="magic-link-fragment-guard" strategy="beforeInteractive">
          {`(function () {
            try {
              if (window.location.pathname === '/login/magic-link' && window.location.hash) {
                window.sessionStorage.setItem(${JSON.stringify(MAGIC_LINK_FRAGMENT_STASH_KEY)}, window.location.hash);
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            } catch (e) {
              // sessionStorage can throw (private mode, disabled storage). Leave the fragment
              // where it is rather than lose the token; MagicLinkCallback.tsx falls back to it.
            }
          })();`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
