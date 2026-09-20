import { WalletManager, NetworkId } from '@txnlab/use-wallet-react';
import { pera } from '@txnlab/use-wallet-pera';
import { walletConnect } from '@txnlab/use-wallet-walletconnect';

/**
 * Wallet connection exists for one purpose: signing a top-up.
 *
 * Buying credits is the only moment a user touches a wallet. Every API call after that is
 * signed by the gateway from the pooled custody account, so there is no popup per request.
 */
const isMainnet = (process.env.NEXT_PUBLIC_ALGORAND_NETWORK_PROFILE || 'testnet') === 'mainnet';

/**
 * WalletConnect's project id.
 *
 * Public by design: it identifies this dApp to the WalletConnect relay and ships in the
 * client, which is why it is a `NEXT_PUBLIC_` variable and not a secret. It comes from
 * dashboard.reown.com. Without it the relay refuses the session, so the wallet is not
 * offered at all rather than offered and broken. See `.env.example`.
 */
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '';

export const hasWalletConnect = walletConnectProjectId !== '';

/**
 * Pera, and WalletConnect when it is configured.
 *
 * `WalletId.DEFLY` was listed here for a long time without `@blockshake/defly-connect` ever
 * being installed, so choosing Defly could never have connected. Adding the package would
 * pull in WalletConnect **v1**, which is end-of-life and carries four high-severity advisories
 * (`ws` DoS, `bn.js` infinite loop) with no fixed release available — 1.2.1 is the last
 * version that exists.
 *
 * That advisory is about v1 and does not apply here. `@txnlab/use-wallet-walletconnect` is
 * built on `@walletconnect/sign-client` 2.23.4, which is v2 and maintained, and
 * `npm audit --omit=dev` reports 0 vulnerabilities with it installed. It also reaches Defly
 * and the other WalletConnect-compatible Algorand wallets without the v1 package, which is
 * the trade the paragraph above was waiting for.
 *
 * One wart, recorded rather than hidden: the adapter pins `@walletconnect/modal` 2.7.0, which
 * npm marks deprecated in favour of Reown AppKit. It works and it is not a vulnerability. The
 * pin belongs to the adapter, so it moves when the adapter moves.
 */
export const walletManager = new WalletManager({
  // use-wallet v5 moved every adapter into its own package and takes factories here,
  // rather than the v4 `WalletId` enum.
  wallets: [
    pera({ compactMode: true }),
    ...(hasWalletConnect
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'Spigot',
              description: 'APIs, metered per call.',
              url: process.env.NEXT_PUBLIC_APP_URL || 'https://spigot.sh',
              icons: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://spigot.sh'}/logo-mono.svg`],
            },
          }),
        ]
      : []),
  ],
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

/**
 * The network profile, as one boolean.
 *
 * Exported so surfaces that are not Algorand-specific can still ask the one question that
 * matters to them: is this a test network. Reading the environment variable a second time
 * elsewhere is how the two answers drift apart.
 */
export const isTestnetProfile = !isMainnet;

export const walletNetworkLabel = isMainnet ? 'Algorand MainNet' : 'Algorand TestNet';
