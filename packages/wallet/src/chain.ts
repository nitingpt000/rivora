import { defineChain } from 'viem';

/**
 * Arc Testnet.
 *
 * Every value is environment-driven with a real default, because the chain id,
 * RPC and explorer are exactly what changes when this stops being a prototype.
 * Hard-coding them would put a redeploy between the product and a network move.
 *
 * Defaults are taken from Circle's Arc documentation, not from the PRD — an
 * earlier version of this file guessed them and every one was wrong, which is
 * the kind of error that only surfaces when a real wallet tries to connect.
 *
 * `NEXT_PUBLIC_` prefixes are required: the connector runs in the browser, so
 * these are inlined at build time and are public by definition. Never put a
 * key that matters behind one.
 */
function env(name: string, fallback: string): string {
  const value = typeof process !== 'undefined' ? process.env[name] : undefined;
  return value && value.length > 0 ? value : fallback;
}

export const ARC_CHAIN_ID = Number(env('NEXT_PUBLIC_ARC_CHAIN_ID', '5042002'));
export const ARC_RPC_URL = env('NEXT_PUBLIC_ARC_RPC_URL', 'https://rpc.testnet.arc.io');
export const ARC_EXPLORER_URL = env(
  'NEXT_PUBLIC_ARC_EXPLORER_URL',
  'https://testnet.arcscan.app',
);

/**
 * USDC on Arc has two decimal scales, and they are not interchangeable.
 *
 *  - As the **native gas token** it uses **18 decimals**, which is what
 *    `nativeCurrency` below describes and what a wallet renders as a balance.
 *  - Through its **ERC-20 interface** at `USDC_ADDRESS` it uses **6 decimals**,
 *    which is what contracts hold and what every figure in this product means.
 *
 * Reading a native balance as 6 decimals overstates it by a factor of 10^12.
 * Anything formatting a token amount must use `USDC_DECIMALS`, not this.
 */
export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: ARC_EXPLORER_URL },
  },
  testnet: true,
});

/**
 * USDC's ERC-20 interface on Arc. A precompile-style fixed address rather than
 * a deployed token, so it is the same on every Arc network.
 */
export const USDC_ADDRESS = env(
  'NEXT_PUBLIC_USDC_ADDRESS',
  '0x3600000000000000000000000000000000000000',
) as `0x${string}`;

/** Decimals of the ERC-20 interface — the scale every protocol figure uses. */
export const USDC_DECIMALS = 6;

/**
 * Circle Gateway's deposit contract, where nanopayment proceeds are held
 * before a burn intent withdraws them to a recipient on Arc.
 *
 * Same address across every EVM testnet Gateway supports.
 */
export const GATEWAY_WALLET_ADDRESS = env(
  'NEXT_PUBLIC_GATEWAY_WALLET_ADDRESS',
  '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
) as `0x${string}`;

export function explorerTxUrl(hash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}
