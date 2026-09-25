/**
 * Builds the Content-Security-Policy header value applied to every route (see next.config.ts).
 *
 * Kept dependency-free and framework-free, same as src/lib/gatewayUrl.ts and
 * src/lib/domainVerification.ts, so it can be exercised directly by the Node test runner.
 *
 * --- frame-src, and where each origin comes from ---
 *
 * Razorpay (https://api.razorpay.com):
 * Codex round 2 (follows up c3805b4) traced `payByCard` in `src/credits/TopUpPanel.tsx`:
 * `new window.Razorpay(...).open()` from the hosted `checkout.razorpay.com/v1/checkout.js`
 * script. That trace assumed the overlay was served from `checkout.razorpay.com` itself; round
 * 3 checked that assumption two ways instead of repeating it:
 *   1. Static: the string "checkout.razorpay.com" does not appear anywhere in the body of
 *      `checkout.js` (only as the `<script src>` origin, which frame-src does not govern).
 *      The widget's own default config builds the iframe URL from `api.razorpay.com` alone
 *      (`{api: "https://api.razorpay.com/", ...}`, read by the internal `At()`/`Y()` helpers
 *      that construct the iframe `src`).
 *   2. Live: a throwaway page served with this exact CSP, real `checkout.js`, and Razorpay's
 *      published public test key (`rzp_test_1DP5mmOlF5G5ag`, no card entered) opened the
 *      checkout with `frame-src https://api.razorpay.com` only. The iframe that appeared had
 *      `src = https://api.razorpay.com/v1/checkout/public?...` and rendered the "Test Mode"
 *      checkout UI with zero CSP violations. Pointing frame-src at an unrelated origin instead
 *      reproduced `CSP-VIOLATION directive=frame-src blockedURI=https://api.razorpay.com` on
 *      the same click, confirming both that the test harness actually detects a block and that
 *      this is the one origin that matters.
 * `checkout.razorpay.com` is dropped from frame-src as a result: it is not where the iframe is
 * served from, and the finding this file answers ("allow only what is needed") is about
 * proving origins, not carrying one forward unverified. It stays implicitly allowed for
 * script-src, which this CSP does not yet restrict (see below).
 *
 * Firebase (the configured NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, only when set):
 * dac9c95 hard-coded frame-src to the two Razorpay origins above, which is why Google sign-in
 * broke: `signInWithPopup` (src/auth/SignInPanel.tsx) needs a same-document iframe for its own
 * auth-event relay, separate from the OAuth consent screen. Read from the installed
 * `@firebase/auth` package (node_modules/@firebase/auth/dist/esm/index-4NFEPWkC.js, the
 * `firebase` version pinned in package.json):
 *   - `_openIframe()` calls `context.open({ where: document.body, url: getIframeUrl(auth), ... })`
 *     — a real iframe inserted into this document. `getIframeUrl` builds
 *     `` `https://${auth.config.authDomain}/${IFRAME_PATH}` `` where
 *     `IFRAME_PATH = '__/auth/iframe'`. This is the "helper iframe" Codex flagged, and it needs
 *     the configured auth domain in frame-src. Live-checked the same way as Razorpay: a page
 *     appending `<iframe src="https://<authDomain>/__/auth/iframe">` (mirroring `_openIframe`
 *     exactly) loaded cleanly once that domain was in frame-src (`onload` fired, zero CSP
 *     violations); serving the same page with round 2's actual shipped frame-src (the two
 *     Razorpay origins only, no auth domain) reproduced the regression directly —
 *     `CSP-VIOLATION directive=frame-src blockedURI=https://<authDomain>` on the identical
 *     `appendChild` call.
 *   - The OAuth handshake itself (`WIDGET_PATH = '__/auth/handler'`, also under the auth
 *     domain) is opened with `window.open(url, target, optionsString)` — a new browser window,
 *     not an iframe. `frame-src` does not apply to it, so `accounts.google.com` (where that
 *     popup ends up after Firebase's own redirect) needs nothing here.
 *   - The `gapi.iframes` library the auth-event iframe depends on is loaded from
 *     `https://apis.google.com/js/api.js` via a `<script>` tag (`gapiScript` in the same
 *     bundle). That is a script-src concern, not frame-src.
 *   - Firebase's own network calls (ID-token verification, session refresh) go to
 *     `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` — a connect-src
 *     concern, not frame-src.
 * script-src and connect-src stay unset here, same as they were left after c3805b4: this CSP
 * does not restrict them yet, so `apis.google.com`, `identitytoolkit.googleapis.com` and
 * `securetoken.googleapis.com` are already reachable without changing anything. Restricting
 * either directive is separate work that needs its own browser-tested pass (building and
 * running this app needed `npm ci` for `firebase`, which was not installed in the checkout
 * either round 1 or round 2 judged).
 *
 * Codex round 4 (follows up c3805b4+dac9c95+c91b585): `env.firebaseAuthDomain` is
 * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, an env var, spliced into `frame-src` with no validation.
 * The CSP grammar splits a directive's value on whitespace into separate source expressions, so
 * a value containing a space — `"evil.example x402.firebaseapp.com"` — did not become one
 * (malformed) origin, it became *two* frame-src sources, one of them `https://evil.example`, an
 * origin this file never intended to allow. A value containing `;` similarly does not stay
 * inside frame-src at all: everything after it is a second directive, letting a misconfigured
 * or attacker-influenced env var widen the policy past frame-src, e.g.
 * `"x.test; script-src 'unsafe-inline'"`. `isSingleHostname` rejects anything that is not
 * exactly one well-formed DNS hostname — no whitespace, no `;`, `,`, `/`, or other CSP/URL
 * separators — before it is trusted as a frame-src origin; an invalid value is dropped instead
 * of shipped, so a bad env var fails closed (Google sign-in's helper iframe stays blocked, the
 * same safe state as `firebaseAuthDomain` being unset) rather than widening the header. See
 * test/csp.test.ts for the malformed-value cases (embedded space, `;`, `,`, wildcard).
 */

/** A bare DNS hostname — no scheme, path, port, query string, or CSP source-list separators
 *  (space, `;`, `,`). This is what `frame-src` may safely interpolate a single trusted origin
 *  from: the CSP header is itself just a string, so anything that is not exactly one hostname
 *  risks being parsed as extra directives or extra sources instead of the one origin intended. */
function isSingleHostname(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

export function buildContentSecurityPolicy(env: { firebaseAuthDomain?: string }): string {
  const frameSrcOrigins = ['https://api.razorpay.com'];
  if (env.firebaseAuthDomain && isSingleHostname(env.firebaseAuthDomain)) {
    frameSrcOrigins.push(`https://${env.firebaseAuthDomain}`);
  }

  return [
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-src ${frameSrcOrigins.join(' ')}`,
  ].join('; ');
}
