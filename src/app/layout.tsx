import type { Metadata } from 'next';
import { Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import Providers from './providers';
import { MAGIC_LINK_FRAGMENT_STASH_KEY, MAGIC_LINK_MEMORY_STASH_KEY } from '../lib/magicLinkFlow';
import '../styles/index.css';

/**
 * The guard script's source, shared by the `<head>` tag below and nothing else — kept as a
 * plain string (not JSX) so `dangerouslySetInnerHTML` can inline it verbatim.
 */
const MAGIC_LINK_GUARD_SCRIPT = `(function () {
  var STASH_KEY = ${JSON.stringify(MAGIC_LINK_FRAGMENT_STASH_KEY)};
  var MEMORY_KEY = ${JSON.stringify(MAGIC_LINK_MEMORY_STASH_KEY)};
  function clearStash() {
    try { window.sessionStorage.removeItem(STASH_KEY); } catch (e) {}
    try { delete window[MEMORY_KEY]; } catch (e) { window[MEMORY_KEY] = undefined; }
  }
  try {
    if (window.location.pathname === '/login/magic-link' && window.location.hash) {
      var hash = window.location.hash;
      // Clear the URL first, unconditionally, before either stash is attempted — this is what
      // keeps the token out of reach of any script that runs after this one, even one that
      // throws below.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      try {
        window.sessionStorage.setItem(STASH_KEY, hash);
      } catch (e) {
        window[MEMORY_KEY] = hash;
      }
      window.addEventListener('pagehide', clearStash);
    }
  } catch (e) {
    // Reading location.* or replaceState itself failing leaves the fragment in the URL;
    // MagicLinkCallback.tsx's own live-hash fallback still picks it up.
  }
})();`;

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
      {/*
        A hand-placed inline tag with no `src`, not `next/script`'s `strategy="beforeInteractive"`.
        That strategy does not put the script's code inline as the first thing in `<head>` — it
        pushes the source onto a `self.__next_s` queue that a later, `async` framework chunk
        reads and runs; the built HTML (checked with `curl localhost:5173/login/magic-link` after
        `next build && next start`) showed several `<script src=... async>` framework chunks
        already sitting in `<head>` *before* that queued source ever appeared in `<body>`.

        Moving to a hand-placed tag does not, on its own, make this script the literal first
        byte of `<head>` either: Next 16's App Router reorders resource-priority elements (font
        preloads, the stylesheet, the same required `async` framework chunks) ahead of *any*
        author-supplied `<head>` child, including this one, regardless of where it is written in
        this component's JSX — checked the same way, by curling the built page after this change
        and finding this script still textually after those chunks. That reordering is a
        framework behavior this component cannot opt out of from inside a layout or page; closing
        it completely would mean keeping `Providers` (and the Firebase/WalletProvider
        initialization it pulls in) out of the render tree for this one route, which lives in
        `src/app/providers.tsx` — outside this change's scope.

        What this placement does still guarantee, and what a real browser confirmed: a
        synchronous inline `<script>` with no `src` always runs to completion during HTML
        parsing, strictly before the parser reaches `<body>` — and hydration cannot start until
        the DOM it hydrates onto exists, i.e. not before `<body>` has parsed. `async` framework
        `<script src>` tags declared earlier in `<head>` mostly just register modules in a
        registry; nothing observed in this app (checked: no `location.hash`/`location.href` read
        anywhere in `src/wallet`, `lib/firebase.ts`, or `SignInPanel.tsx`'s Firebase usage, which
        is `signInWithPopup`, never the redirect flow that would parse the URL) actually reads
        the fragment before this script clears it. Loading `/login/magic-link#token=...` in a
        real browser (Chrome, via the `claude-in-chrome` MCP tools) and reading the resulting
        `sessionStorage`/`window.location.hash`/network requests immediately after showed the
        fragment already stripped, the stash already consumed, and no request — including the
        POST to `/auth/magic-link/callback` — ever carrying the token anywhere but its body.

        The URL is stripped of the fragment first, in the same synchronous pass, before either
        stash below is attempted — so an SDK cannot read the token off `location.hash` even when
        both stashes fail. `sessionStorage.setItem` is the durable stash (survives this script
        re-running on a reload of the same document); it can still throw (private mode, disabled
        storage, a full quota), so the token falls back to a plain `window` property — gone on
        reload, but that is fine, since a reload re-runs this script from a fresh fragment, not a
        lost one. `pagehide` clears both stashes as a last resort, for the case hydration never
        reaches `MagicLinkCallback.tsx` to consume them itself (a crash, or the tab closing
        before React mounts) — the token must not outlive the document it arrived in. Both the
        storage-failure fallback and the `pagehide` cleanup were replayed against this exact
        source, live, in the same real browser (sessionStorage.setItem forced to throw): the
        memory fallback held the fragment, sessionStorage stayed empty, and `pagehide` cleared
        the fallback.

        Gated to `/login/magic-link` by the check inside it, so every other route is untouched.
        MagicLinkCallback.tsx reads the durable stash, then the memory one, then falls back to a
        live `location.hash` only if neither stash was set (e.g. a cached HTML shell from before
        this change).
      */}
      <head>
        <script
          id="magic-link-fragment-guard"
          dangerouslySetInnerHTML={{ __html: MAGIC_LINK_GUARD_SCRIPT }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
