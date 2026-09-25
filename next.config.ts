import type { NextConfig } from 'next';

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
   * Codex round 2 (follows up c3805b4): traced the Razorpay card flow in
   * `src/credits/TopUpPanel.tsx` (`payByCard`, `RAZORPAY_SRC`) end to end. `new
   * window.Razorpay(...).open()` renders Razorpay's payment UI, including card 3-D Secure and
   * netbanking/UPI redirects, inside an iframe that Razorpay itself hosts and serves headers
   * for — the dashboard document never submits a form to Razorpay or any other cross-origin
   * target (the handler callback only calls our own `/api/credits/razorpay/verify-payment`), so
   * `form-action 'self'` already covers it and needs no change. `grep -rn "iframe" src` finds
   * none, so Razorpay is the only frame this app ever opens:
   * - frame-src: checkout.razorpay.com and api.razorpay.com are where that overlay is served
   *   from, both observed in Razorpay's own checkout.js.
   * script-src and connect-src stay unset. `npm run build` fails in this checkout (`firebase`
   * is not installed, matching the finding in c3805b4), so a script-src could not be verified
   * against this app's own inline hydration scripts (Next's App Router streams React Server
   * Component data via inline `<script>` tags, which an un-nonced script-src blocks) or against
   * Firebase auth and the WalletConnect relay, both of which call out from this document same
   * as Razorpay's checkout.js does. Locking either of those down needs the browser-tested pass
   * this file already called for.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; " +
              'frame-src https://checkout.razorpay.com https://api.razorpay.com',
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
