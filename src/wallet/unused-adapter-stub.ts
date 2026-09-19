/**
 * Stub for the wallet adapters this app does not offer.
 *
 * `@txnlab/use-wallet` declares every adapter it supports as an optional peer dependency and
 * imports them statically. Vite ignored the ones we never installed; Turbopack resolves the
 * whole import graph and fails the build instead. walletManager.ts only registers Pera and
 * Defly, so the rest are aliased here in next.config.ts.
 *
 * If you add a wallet to walletManager.ts, install its package and drop it from that alias
 * list — otherwise it will silently resolve to this empty module.
 */
const unusedAdapterStub = {};

export default unusedAdapterStub;
