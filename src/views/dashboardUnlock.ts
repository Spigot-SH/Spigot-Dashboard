/**
 * The unlock-tutorial request/confirm flow, pulled out of `Dashboard.tsx`'s `handleUnlockTutorial`
 * so it can be unit tested with Node's own `--test` runner (see `test/domainVerification.test.ts`
 * for why: this repo has no test runner beyond that, and `Dashboard.tsx` has JSX, which Node's
 * `--experimental-strip-types` does not transform).
 *
 * Regression this exists to close (Codex round-2 rejection of 10c90b0,
 * local/security-fixes/judge/f26d.q.out): "An unlock failure still opens the tutorial as though
 * the debit succeeded." The old code called the unlock endpoint, ignored whether it threw, and
 * opened the tutorial unconditionally. A 402 (insufficient credit), a 500, or a client-side
 * timeout all look the same from here — the request either resolved or it did not — and none of
 * them says whether the debit actually landed (a 500 can follow a committed write; a timeout can
 * follow either a committed or a never-sent one). Only a freshly re-read session says what the
 * ledger actually recorded, so the tutorial opens if and only if that refreshed session confirms
 * the unlock — never on the strength of the request having been sent.
 */
export interface UnlockFlowResult {
  /** Whether the tutorial should open: true only when the refreshed session confirms it. */
  opened: boolean;
  /** The refreshed session, for the caller to also update its own state from. */
  session: { tutorialUnlocked?: boolean };
}

export const runUnlockFlow = async (
  requestUnlock: () => Promise<unknown>,
  refreshSession: () => Promise<{ tutorialUnlocked?: boolean }>,
): Promise<UnlockFlowResult> => {
  try {
    await requestUnlock();
  } catch {
    // A rejected (402), failed (500) or uncertain (timeout, dropped connection) request is not
    // "the debit did not happen" — only the refreshed session below can say either way.
  }
  const session = await refreshSession();
  return { opened: session.tutorialUnlocked === true, session };
};
