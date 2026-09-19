import type { Metadata } from 'next';
import { Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import Providers from './providers';
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
    default: 'Spigot — APIs, metered per call',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
