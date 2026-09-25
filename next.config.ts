import type { NextConfig } from 'next';
import { buildContentSecurityPolicy } from './src/lib/csp';

/**
 * Wallet adapters `@txnlab/use-wallet` imports but this app never registers.
 *
 * They are optional peer dependencies, so they are not installed. Turbopack resolves the full
 * import graph and fails on them, where Vite simply skipped them. Pointing each at an empty
 * module keeps them out of the bundle.
 *
 * `@walletconnect/modal` and `@walletconnect/sign-client` were on this list and are not any
 * more: the app registers WalletConnect now, so they are real dependencies and stubbing them
 * breaks the build with "Export SignClient doesn't exist in target module". An entry here
 * that is also a registered wallet resolves to an empty object and fails loudly, which is the
 * behaviour `src/wallet/unused-adapter-stub.ts` warns about.
 */
const UNUSED_WALLET_ADAPTERS = [
  '@agoralabs-sh/avm-web-provider',
  '@blockshake/defly-connect',
  'lute-connect',
];

/** Turbopack resolves alias targets relative to the project root, so this must stay relative. */
const adapterStub = './src/wallet/unused-adapter-stub.ts';

/**
 * Where the Express API actually lives.
 *
 * This is a server-side value on purpose — it is read by the rewrite engine in the Next
 * process, never inlined into the browser bundle. The browser always talks to the Next
 * origin, so the httpOnly session cookie stays same-site and no CORS preflight is needed.
 */
const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:4402').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next writes AGENTS.md and CLAUDE.md into this directory on dev startup unless told not to.
  agentRules: false,

  /**
   * Avatars come from Google sign-in only. An explicit allowlist means a compromised or
   * malicious `avatarUrl` in the session response cannot make the app load an arbitrary
   * remote host — `next/image` refuses any origin not listed here.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
    ],
  },

  turbopack: {
    resolveAlias: Object.fromEntries(UNUSED_WALLET_ADAPTERS.map(pkg => [pkg, adapterStub])),
  },

  /**
   * Replaces the old Vite dev proxy, and extends it to production.
   *
   * `/x402` must reach the gateway byte-for-byte: payment payloads are base64 in headers and
   * the upstream body is proxied verbatim. Rewrites pass the request through untouched, which
   * is why the gateway is not wrapped in a Route Handler.
   */
  /**
   * The app signs people in and moves money, so it must not be framed (clickjacking on
   * withdraw, settle or payout forms) and must not be sniffed or leak full URLs in Referer.
   *
   * Codex round 3 (follows up c3805b4+dac9c95): round 2's frame-src was Razorpay-only, which
   * broke Google sign-in — `signInWithPopup` (src/auth/SignInPanel.tsx) opens a same-document
   * helper iframe at the configured Firebase auth domain, and a CSP that does not list that
   * domain silently blocks it. `buildContentSecurityPolicy` (src/lib/csp.ts) now builds
   * frame-src from `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` so that iframe is allowed whenever
   * Firebase is configured, and adds nothing when it is not (`firebaseConfigured` in
   * src/lib/firebase.ts already hides "Continue with Google" in that case). See src/lib/csp.ts
   * for the full evidence trail: why the Razorpay origin changed to `api.razorpay.com` only,
   * why script-src/connect-src still don't need Firebase's `apis.google.com` /
   * `identitytoolkit.googleapis.com` / `securetoken.googleapis.com` while they stay unset, and
   * why `accounts.google.com` needs nothing here (Firebase's OAuth handshake opens in a new
   * window via `window.open`, not an iframe, so frame-src does not govern it).
   *
   * form-action 'self': `payByCard` (src/credits/TopUpPanel.tsx) never submits a document-level
   * form to Razorpay. `new window.Razorpay(...).open()` renders card 3-D Secure and
   * netbanking/UPI entirely inside the iframe above (confirmed live below); completion comes
   * back through that iframe's `handler` callback, which calls only our own
   * `/api/credits/razorpay/verify-payment`. `grep -rn "iframe" src` finds no other iframe or
   * cross-origin form in this app, so `form-action 'self'` needs no change.
   *
   * Live check: `npm ci` (Node 22) installs `firebase`, fixing the typecheck failure round 1
   * and round 2 hit; `npm run build` and `npm start` succeed with this CSP, and `curl -sI` on
   * the running app shows the header this function actually produces. A full real sign-in
   * end to end could not be checked — no Firebase project is configured in this environment
   * (`.env.local` does not exist here) — but the two mechanisms this fix touches were each
   * checked live: Razorpay's real `checkout.js` opened its checkout with zero CSP violations
   * against `frame-src https://api.razorpay.com` alone, and a page appending the exact iframe
   * `_openIframe()` builds (`<iframe src="https://<authDomain>/__/auth/iframe">`) loaded clean
   * once that origin was added to frame-src. A negative control for each — an unrelated
   * frame-src for Razorpay, round 2's actual shipped frame-src (Razorpay only) for Firebase —
   * reproduced the exact blocks Codex is asking about, proving the checks themselves detect a
   * block rather than passing by accident. Details, and the static trace of `checkout.js` that
   * led to dropping `checkout.razorpay.com` from frame-src, are in src/lib/csp.ts.
   *
   * `headers()` is resolved once at `next build` (confirmed here: restarting `next start` with
   * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` newly set did not change the served header; rebuilding
   * did), same as `BACKEND_ORIGIN` below — the auth domain must be set before `npm run build`,
   * not just before `npm start` or at deploy restart.
   *
   * Codex round 4 (follows up c3805b4+dac9c95+c91b585): `buildContentSecurityPolicy` now
   * rejects a `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` that is not a single bare hostname (whitespace,
   * `;`, `,`, a scheme or a path all fail closed instead of splicing into frame-src — see
   * src/lib/csp.ts and test/csp.test.ts) before this function embeds it in the header. Still
   * unresolved and not closed by this round, same limitation prior rounds recorded: an actual
   * Razorpay payment through 3-D Secure/UPI/netbanking redirects and an actual Google popup
   * sign-in through session creation, both under this served header, need a live Razorpay
   * account and a configured Firebase project (`.env.local`) that this checkout does not have.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy({
              firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            }),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: '/x402/:path*', destination: `${BACKEND_ORIGIN}/x402/:path*` },

      /**
       * The design system is a static site in `public/designsystem/`. Next serves files out of
       * `public/` but does not resolve a directory to its `index.html`, so `/designsystem`
       * alone would 404. Relative asset paths keep working because the browser URL is
       * unchanged — a rewrite is server-side only, unlike a redirect.
       */
      { source: '/designsystem', destination: '/designsystem/index.html' },
    ];
  },
};

export default nextConfig;
