/**
 * EVM wallet integration for MetaMask, Coinbase Wallet, Rabby and, over WalletConnect, the
 * wallets that live on a phone. Supports chain switching and EIP-712/EIP-3009 gasless payment
 * payload generation.
 *
 * Every call here goes through `activeProvider()` rather than reaching for `window.ethereum`
 * directly. Three functions used to read that global independently, which is why a phone
 * wallet could not be supported without touching all three: the provider is a value, not a
 * place.
 */

/** The EIP-1193 surface this module needs. Both an injected wallet and WalletConnect have it. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
}

export type EvmConnection = 'injected' | 'walletconnect';

let provider: Eip1193Provider | null = null;
let connection: EvmConnection | null = null;

const injected = (): Eip1193Provider | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { ethereum?: Eip1193Provider }).ethereum;

/** Whichever provider the user connected with, or the injected one if they never chose. */
const activeProvider = (): Eip1193Provider | undefined => provider || injected();

export const activeEvmConnection = (): EvmConnection | null => connection;

export interface EvmChainConfig {
  key: string;
  chainId: number;
  caip2: string;
  name: string;
  currencySymbol: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcAddress: string;
}

export const EVM_TESTNET_CHAINS: Record<string, EvmChainConfig> = {
  base: {
    key: 'base',
    chainId: 84532,
    caip2: 'eip155:84532',
    name: 'Base Sepolia',
    currencySymbol: 'ETH',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  ethereum: {
    key: 'ethereum',
    chainId: 11155111,
    caip2: 'eip155:11155111',
    name: 'Ethereum Sepolia',
    currencySymbol: 'ETH',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  arbitrum: {
    key: 'arbitrum',
    chainId: 421614,
    caip2: 'eip155:421614',
    name: 'Arbitrum Sepolia',
    currencySymbol: 'ETH',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  optimism: {
    key: 'optimism',
    chainId: 11155420,
    caip2: 'eip155:11155420',
    name: 'Optimism Sepolia',
    currencySymbol: 'ETH',
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  },
  avalanche: {
    key: 'avalanche',
    chainId: 43113,
    caip2: 'eip155:43113',
    name: 'Avalanche Fuji',
    currencySymbol: 'AVAX',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://testnet.snowtrace.io',
    usdcAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
  },
  robinhood: {
    key: 'robinhood',
    chainId: 46630,
    caip2: 'eip155:46630',
    name: 'Robinhood Testnet',
    currencySymbol: 'ETH',
    rpcUrl: 'https://rpc.robinhoodchain.com',
    explorerUrl: 'https://robinscan.com',
    usdcAddress: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  },
};

export const hasInjectedEvmProvider = (): boolean => Boolean(injected());

export const connectInjectedEvmWallet = async (): Promise<string> => {
  const ethereum = injected();
  if (!ethereum) {
    throw new Error('No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or Rabby.');
  }

  const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];

  if (!accounts || !accounts[0]) {
    throw new Error('No EVM account selected in wallet');
  }

  provider = ethereum;
  connection = 'injected';
  return accounts[0];
};

/**
 * Connect a wallet that is not in this browser, over WalletConnect v2.
 *
 * Imported at call time, not at module load. The WalletConnect provider is a large tree and
 * most visitors never open this tab, so it is code-split behind the click that needs it.
 *
 * Every testnet chain is offered in `optionalChains` rather than `chains`, because a required
 * chain the wallet does not know makes it refuse the session outright. The chain the payment
 * needs is switched to afterwards by `switchOrAddEvmChain`, the same as for an injected wallet.
 */
export const connectWalletConnectEvmWallet = async (projectId: string): Promise<string> => {
  if (!projectId) {
    throw new Error('WalletConnect is not configured for this deployment.');
  }

  const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://spigot.sh');

  const wc = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    optionalChains: Object.values(EVM_TESTNET_CHAINS).map(c => c.chainId) as [number, ...number[]],
    metadata: {
      name: 'Spigot',
      description: 'APIs, metered per call.',
      url: appUrl,
      icons: [`${appUrl}/logo-mono.svg`],
    },
  });

  await wc.connect();
  const accounts = (await wc.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts || !accounts[0]) {
    throw new Error('No EVM account selected in wallet');
  }

  provider = wc as unknown as Eip1193Provider;
  connection = 'walletconnect';
  return accounts[0];
};

/** Drop the session so the next connect starts clean, and forget the provider either way. */
export const disconnectEvmWallet = async (): Promise<void> => {
  try {
    if (connection === 'walletconnect') await provider?.disconnect?.();
  } catch (error) {
    console.warn('EVM wallet disconnect failed:', error);
  }
  provider = null;
  connection = null;
};

export const switchOrAddEvmChain = async (chain: EvmChainConfig): Promise<void> => {
  const ethereum = activeProvider();
  if (!ethereum) return;

  const hexChainId = `0x${chain.chainId.toString(16)}`;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number; data?: { originalError?: { code?: number } } };
    if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexChainId,
            chainName: chain.name,
            nativeCurrency: {
              name: chain.currencySymbol,
              symbol: chain.currencySymbol,
              decimals: 18,
            },
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
    } else {
      throw error;
    }
  }
};

export const signExactEvmPayment = async (
  requirements: unknown,
  accountAddress: string,
): Promise<string> => {
  const { createWalletClient, custom } = await import('viem');
  const { ExactEvmScheme } = await import('@x402/evm/exact/client');

  const ethereum = activeProvider();
  if (!ethereum) {
    throw new Error('No EVM wallet available to sign payment');
  }

  const req = requirements as {
    network: string;
    asset?: string;
    extra?: { name?: string; version?: string; decimals?: number };
  };

  const chain = Object.values(EVM_TESTNET_CHAINS).find(c => c.caip2 === req.network);
  const defaultName =
    chain?.name === 'Arbitrum Sepolia' ||
    chain?.name === 'Optimism Sepolia' ||
    chain?.name === 'Avalanche Fuji'
      ? 'USD Coin'
      : 'USDC';

  const enrichedRequirements = {
    ...req,
    extra: {
      decimals: 6,
      name: req.extra?.name || defaultName,
      version: req.extra?.version || '2',
      ...(req.extra || {}),
    },
  };

  const client = createWalletClient({
    account: accountAddress as `0x${string}`,
    transport: custom(ethereum as never),
  });

  const signer = {
    address: accountAddress as `0x${string}`,
    signTypedData: async (params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => {
      const signFn = client.signTypedData as (args: unknown) => Promise<`0x${string}`>;
      return signFn({
        account: accountAddress as `0x${string}`,
        domain: params.domain,
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      });
    },
  };

  const scheme = new ExactEvmScheme(signer as never);
  const result = await scheme.createPaymentPayload(2, enrichedRequirements as never);

  return btoa(
    JSON.stringify({
      x402Version: 2,
      scheme: 'exact',
      network: req.network,
      payload: result.payload,
    }),
  );
};
