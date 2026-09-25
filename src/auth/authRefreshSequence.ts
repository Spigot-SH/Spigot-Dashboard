/**
 * A monotonically increasing sequence guard for `AuthContext.tsx`'s `refresh()`.
 *
 * `AuthProvider` calls `refresh()` from more than one place — its own mount effect, the
 * `?signed_in=1` effect that fires after the magic-link callback sets the cookie, and the
 * callback itself (`src/views/MagicLinkCallback.tsx:115-124`) calling `useAuth().refresh()`
 * directly. Two of those can be in flight at once, and network timing does not guarantee they
 * resolve in the order they started: an earlier call (reading a stale or signed-out cookie) can
 * resolve *after* a later, verified call and apply its state last, silently signing the shared
 * provider out or back into the previous user right after the callback proved the new session.
 *
 * `start()` is called synchronously when a `refresh()` call begins, before its `await`; the
 * ticket it returns is passed to `isCurrent()` once that call's response comes back. Only the
 * response to the most recently started call is ever current — every earlier one, however it
 * resolves, is dropped instead of applied. No React here (no JSX, no `window`) so this runs
 * under Node's own test runner — same pattern as `src/lib/magicLinkFlow.ts` and
 * `src/views/dashboardUnlock.ts`.
 */
export const createRefreshSequencer = (): {
  start: () => number;
  isCurrent: (ticket: number) => boolean;
} => {
  let latest = 0;
  return {
    start: (): number => {
      latest += 1;
      return latest;
    },
    isCurrent: (ticket: number): boolean => ticket === latest,
  };
};
