import { WalletManager, NetworkId } from '@txnlab/use-wallet-react';
import { pera } from '@txnlab/use-wallet-pera';

/**
 * Wallet connection exists for one purpose: signing a top-up.
 *
 * Buying credits is the only moment a user touches a wallet. Every API call after that is
 * signed by the gateway from the pooled custody account, so there is no popup per request.
 */
const isMainnet = (process.env.NEXT_PUBLIC_ALGORAND_NETWORK_PROFILE || 'testnet') === 'mainnet';

/**
 * Pera only, deliberately.
 *
 * `WalletId.DEFLY` was listed here for a long time without `@blockshake/defly-connect` ever
 * being installed, so choosing Defly could never have connected. Adding the package would
 * pull in WalletConnect v1, which is end-of-life and carries four high-severity advisories
 * (`ws` DoS, `bn.js` infinite loop) with no fixed release available — 1.2.1 is the last
 * version that exists. Shipping a known-vulnerable EOL dependency to enable a wallet that has
 * never worked is a bad trade.
 *
 * To restore Defly: install the package, drop it from the alias list in `next.config.ts`, and
 * accept the WalletConnect v1 advisories.
 */
export const walletManager = new WalletManager({
  // use-wallet v5 moved every adapter into its own package and takes factories here,
  // rather than the v4 `WalletId` enum.
  wallets: [pera({ compactMode: true })],
  defaultNetwork: isMainnet ? NetworkId.MAINNET : NetworkId.TESTNET,
});

// Suppress unhandled reconnect / bridge errors from @perawallet/connect during session resume
const originalResumeSessions = walletManager.resumeSessions.bind(walletManager);
walletManager.resumeSessions = async () => {
  try {
    await originalResumeSessions();
  } catch (error) {
    console.warn('Algorand wallet session resume suppressed:', error);
  }
};

walletManager.on('error', payload => {
  console.warn('Algorand wallet error handled:', payload?.error || payload);
});

export const walletNetworkLabel = isMainnet ? 'Algorand MainNet' : 'Algorand TestNet';
