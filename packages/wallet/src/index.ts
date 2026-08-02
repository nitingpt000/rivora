/**
 * @rivora/wallet — wallet connection for the Arc network.
 *
 * Wraps wagmi and viem behind a small surface: one provider, one hook, one
 * chain definition. Screens import `useWallet`, never wagmi directly, so the
 * product has a single answer to "who is connected and to what".
 *
 * Configure with `NEXT_PUBLIC_ARC_CHAIN_ID`, `NEXT_PUBLIC_ARC_RPC_URL`,
 * `NEXT_PUBLIC_ARC_EXPLORER_URL`, `NEXT_PUBLIC_USDC_ADDRESS` and, optionally,
 * `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. See `.env.example`.
 */

export {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_RPC_URL,
  GATEWAY_WALLET_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  arcTestnet,
  explorerAddressUrl,
  explorerTxUrl,
} from './chain';
export { getWagmiConfig, hasWalletConnect } from './config';
export type { WagmiConfig } from './config';
export { WalletProvider } from './provider';
export { buildSiweMessage } from './siwe';
export type { SiweMessageParams } from './siwe';
export { shortenAddress, useWallet } from './use-wallet';
export type { Wallet, WalletConnector } from './use-wallet';
