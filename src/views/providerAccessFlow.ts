/**
 * The request-provider-access flow, pulled out of `Dashboard.tsx`/`Start.tsx` the same way
 * `dashboardUnlock.ts`'s `runUnlockFlow` was, so it can be unit tested with Node's own
 * `--test` runner (see `test/domainVerification.test.ts` for why).
 *
 * Same shape as `runUnlockFlow`: whether the request itself resolved or threw (already
 * requested, a network error, a dropped connection) is not the answer — only a freshly
 * re-read session says what the server actually recorded, so the UI reflects that, not the
 * strength of the request having been sent.
 */
export interface ProviderAccessRequestFlowResult {
  /** True once the refreshed session confirms the request landed (requested or approved). */
  requested: boolean;
  session: { providerAccess?: 'requested' | 'approved' | 'revoked' | null };
}

export const runProviderAccessRequestFlow = async (
  requestAccess: () => Promise<unknown>,
  refreshSession: () => Promise<{ providerAccess?: 'requested' | 'approved' | 'revoked' | null }>,
): Promise<ProviderAccessRequestFlowResult> => {
  try {
    await requestAccess();
  } catch {
    // A rejected or failed request is not "nothing happened" — only the refreshed session
    // below can say either way (the backend's request endpoint is also idempotent, so a
    // request that actually landed just before a dropped response is not lost).
  }
  const session = await refreshSession();
  return {
    requested: session.providerAccess === 'requested' || session.providerAccess === 'approved',
    session,
  };
};
