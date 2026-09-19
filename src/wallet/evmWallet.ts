/**
 * Browser EVM wallet integration for MetaMask, Coinbase Wallet, Rabby, etc.
 * Supports chain switching and EIP-712/EIP-3009 gasless payment payload generation.
 */

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

export const hasInjectedEvmProvider = (): boolean => {
  return (
    typeof window !== 'undefined' && Boolean((window as unknown as { ethereum?: unknown }).ethereum)
  );
};

export const connectInjectedEvmWallet = async (): Promise<string> => {
  if (
    typeof window === 'undefined' ||
    !(
      window as unknown as {
        ethereum?: { request: (args: { method: string }) => Promise<string[]> };
      }
    ).ethereum
  ) {
    throw new Error('No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or Rabby.');
  }

  const ethereum = (
    window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }
  ).ethereum;
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

  if (!accounts || !accounts[0]) {
    throw new Error('No EVM account selected in wallet');
  }

  return accounts[0];
};

export const switchOrAddEvmChain = async (chain: EvmChainConfig): Promise<void> => {
  if (typeof window === 'undefined') return;
  const ethereum = (
    window as unknown as {
      ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    }
  ).ethereum;
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

  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
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
