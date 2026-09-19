import {
  isConnected,
  requestAccess,
  getAddress,
  setAllowed,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api';
import { Horizon, Networks, TransactionBuilder, Asset, Operation } from '@stellar/stellar-sdk';

export const STELLAR_TESTNET_USDC_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const STELLAR_MAINNET_USDC_ISSUER =
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export interface FreighterBalances {
  xlm: string;
  usdc: string;
  hasUsdcTrustline: boolean;
}

export const isFreighterInstalled = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  try {
    const res = await isConnected();
    return Boolean(res && res.isConnected);
  } catch {
    return false;
  }
};

export const connectFreighterWallet = async (): Promise<string> => {
  if (typeof window === 'undefined') {
    throw new Error('Window is not available');
  }

  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter wallet extension is not detected. Please install Freighter from https://www.freighter.app/',
    );
  }

  try {
    await setAllowed();
    const accessRes = await requestAccess();
    if (accessRes?.error) {
      throw new Error(
        typeof accessRes.error === 'string' ? accessRes.error : 'Freighter access request denied',
      );
    }
    if (accessRes?.address) {
      return accessRes.address;
    }

    const addrRes = await getAddress();
    if (addrRes?.error) {
      throw new Error(
        typeof addrRes.error === 'string' ? addrRes.error : 'Could not retrieve address',
      );
    }
    if (addrRes?.address) {
      return addrRes.address;
    }

    throw new Error('Could not retrieve public address from Freighter');
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('User rejected Freighter connection or an error occurred');
  }
};

export const getFreighterNetwork = async (): Promise<string> => {
  try {
    const netRes = await getNetwork();
    return netRes?.network || 'TESTNET';
  } catch {
    return 'TESTNET';
  }
};

export const getFreighterBalances = async (
  address: string,
  horizonUrl = 'https://horizon-testnet.stellar.org',
): Promise<FreighterBalances> => {
  try {
    const server = new Horizon.Server(horizonUrl);
    const account = await server.loadAccount(address);
    let xlm = '0';
    let usdc = '0';
    let hasUsdcTrustline = false;

    for (const b of account.balances) {
      if (b.asset_type === 'native') {
        xlm = b.balance;
      } else if ('asset_code' in b && b.asset_code === 'USDC') {
        usdc = b.balance;
        hasUsdcTrustline = true;
      }
    }

    return { xlm, usdc, hasUsdcTrustline };
  } catch {
    return { xlm: '0', usdc: '0', hasUsdcTrustline: false };
  }
};

export const payUsdcWithFreighter = async ({
  payerAddress,
  recipientAddress,
  amountUsdc,
  isMainnet = false,
  horizonUrl = 'https://horizon-testnet.stellar.org',
}: {
  payerAddress: string;
  recipientAddress: string;
  amountUsdc: number;
  isMainnet?: boolean;
  horizonUrl?: string;
}): Promise<{ txHash: string; signedTxXdr: string }> => {
  const server = new Horizon.Server(horizonUrl);
  const networkPassphrase = isMainnet ? Networks.PUBLIC : Networks.TESTNET;
  const issuer = isMainnet ? STELLAR_MAINNET_USDC_ISSUER : STELLAR_TESTNET_USDC_ISSUER;
  const usdcAsset = new Asset('USDC', issuer);

  const payerAccount = await server.loadAccount(payerAddress).catch(() => {
    throw new Error(
      `Freighter account ${payerAddress.slice(0, 4)}…${payerAddress.slice(-4)} was not found on Stellar ${isMainnet ? 'Mainnet' : 'Testnet'}. Please fund it with XLM first.`,
    );
  });

  const balances = await getFreighterBalances(payerAddress, horizonUrl);
  if (!balances.hasUsdcTrustline) {
    throw new Error(
      `Your connected Freighter wallet has no USDC trustline. Please add the USDC trustline in Freighter (${issuer.slice(0, 8)}…).`,
    );
  }
  if (Number(balances.usdc) < amountUsdc) {
    throw new Error(
      `Insufficient USDC balance in connected Freighter wallet. Available: ${balances.usdc} USDC, Required: ${amountUsdc} USDC.`,
    );
  }

  // Build the payment transaction
  const txBuilder = new TransactionBuilder(payerAccount, {
    fee: '10000',
    networkPassphrase,
  }).setTimeout(180);

  txBuilder.addOperation(
    Operation.payment({
      destination: recipientAddress,
      asset: usdcAsset,
      amount: amountUsdc.toFixed(7),
    }),
  );

  const transaction = txBuilder.build();
  const rawXdr = transaction.toXDR();

  // Prompt user in Freighter extension to review and sign the transaction
  const signResult = await signTransaction(rawXdr, {
    networkPassphrase,
    address: payerAddress,
  });

  if (signResult?.error) {
    throw new Error(
      typeof signResult.error === 'string'
        ? signResult.error
        : 'Freighter transaction signing rejected by user',
    );
  }

  const signedTxXdr =
    signResult?.signedTxXdr || (typeof signResult === 'string' ? signResult : null);
  if (!signedTxXdr) {
    throw new Error('Did not receive signed transaction from Freighter');
  }

  // Submit to Horizon network
  try {
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
    const submitRes = await server.submitTransaction(signedTx);
    const txHash = submitRes.hash || (submitRes as unknown as { id?: string }).id;
    if (!txHash) {
      throw new Error('Transaction submission did not return a transaction hash');
    }
    return { txHash, signedTxXdr };
  } catch (submitErr: unknown) {
    const data = (
      submitErr as {
        response?: {
          data?: {
            extras?: {
              result_codes?: { operations?: string[]; transaction?: string };
            };
          };
        };
      }
    )?.response?.data;
    const resultCodes = data?.extras?.result_codes;
    if (resultCodes) {
      const opCode = resultCodes.operations?.[0] || resultCodes.transaction;
      if (opCode === 'op_no_destination') {
        throw new Error(
          'Recipient account is not yet active on Stellar. Please try again or fund with XLM.',
        );
      }
      if (opCode === 'op_no_trust') {
        throw new Error(
          'Recipient account does not have a trustline for USDC. Please check asset setup.',
        );
      }
      if (opCode === 'op_underfunded') {
        throw new Error(
          'Your Freighter wallet has insufficient funds (XLM/USDC) for transaction fees or transfer amount.',
        );
      }
      if (opCode) {
        throw new Error(`Stellar transaction failed on network (${opCode}).`);
      }
    }
    throw submitErr;
  }
};
