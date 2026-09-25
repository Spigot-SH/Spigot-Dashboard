/**
 * Two small, independently testable decisions pulled out of `Dashboard.tsx`, the same way
 * `providerAccessGate.ts`, `dashboardUnlock.ts` and `providerAccessFlow.ts` already are (see
 * those files: this repo's only test runner is Node's own `--test`, which does not transform
 * JSX, so `Dashboard.tsx` itself cannot be imported by a test).
 *
 * Both fix items from the Codex round-2 rejection of Dashboard 10c90b0+969f99e / backend
 * bf82ebe (local/security-fixes/judge/f26dr2.q.out):
 *
 *   "src/views/Dashboard.tsx:171-175,280-301 skips the stats fetch for a locked provider but
 *   still requires non-null stats to render. A fresh locked provider can remain on 'Loading
 *   Dashboard' without an unlock control."
 *
 * `shouldShowLoadingSpinner` is the fix. Once a provider-access-blocked account's fetch is
 * skipped (Dashboard.tsx's effect returns early while `isProviderAccessBlocked`), `stats` never
 * gets set and never will — fetchStats never runs again for that reason alone. Waiting on it
 * before showing anything is waiting forever. The locked/coming-soon card the render shows
 * instead does not read `stats` at all, so once auth has resolved and the account is blocked,
 * there is nothing left to wait for.
 *
 *   "src/views/Dashboard.tsx:101-104,257-263,345-349. A locked user can open the paid MCP
 *   tutorial from Connectors without the confirmed unlock. Test a direct locked Connectors
 *   route."
 *
 * `canOpenTutorial` is the fix. `openTutorial` used to open the modal unconditionally — every
 * caller that hands it to a banner button (`ConnectorsView`, `McpOnboardingBanner` on both the
 * Connectors route and the provider overview) has no unlock check of its own; only
 * `CallerView` already gated its own copy of the banner behind `isUnlocked`. Gating the one
 * shared callback in `Dashboard.tsx` covers every entry point without editing those other
 * components. `tutorialUnlocked` (from `useAuth()`) already reflects the backend's
 * `TUTORIAL_GATE_ENABLED` switch (services/credits.ts `hasUnlockedTutorial`, Spigot-Algorand:
 * off, everyone reads unlocked) — there is nothing else to check here beyond that one boolean.
 */

export const shouldShowLoadingSpinner = (
  loading: boolean,
  hasStats: boolean,
  isProviderAccessBlocked: boolean,
): boolean => loading || (!hasStats && !isProviderAccessBlocked);

export const canOpenTutorial = (tutorialUnlocked: boolean): boolean => tutorialUnlocked === true;
