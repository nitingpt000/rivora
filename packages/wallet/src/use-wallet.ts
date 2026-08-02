'use client';

import { useCallback, useMemo } from 'react';
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
  type Connector,
} from 'wagmi';

import { arcTestnet } from './chain';

export interface WalletConnector {
  id: string;
  name: string;
  /** True while this specific connector is negotiating. */
  pending: boolean;
  connect: () => void;
}

export interface Wallet {
  address: `0x${string}` | undefined;
  /** `0x5d92…3ba6` — the form used throughout the product. */
  shortAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectors: WalletConnector[];
  disconnect: () => void;
  chainId: number | undefined;
  /** Connected, but pointed at something other than Arc. */
  isWrongNetwork: boolean;
  switchToArc: () => void;
  isSwitching: boolean;
  /** Native USDC balance, formatted. Undefined until the RPC answers. */
  balance: string | undefined;
  error: string | null;
  /**
   * Signs an arbitrary message with the connected wallet.
   *
   * Used for Sign-In With Ethereum. Rejects if the user declines the prompt —
   * callers should treat that as a cancellation, not a failure.
   */
  signMessage: (message: string) => Promise<`0x${string}`>;
  isSigning: boolean;
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * One hook for everything the UI needs from a wallet.
 *
 * Wraps wagmi rather than letting screens import it directly, so the connect
 * screen, the chrome and the modals cannot disagree about what "connected"
 * means — and so swapping the underlying library stays a one-file change.
 */
export function useWallet(): Wallet {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { connect, connectors: available, isPending, variables, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const { data: balanceData } = useBalance({
    address,
    chainId: arcTestnet.id,
    query: {
      // Pointless while disconnected or on the wrong chain — the read would
      // either fail or describe a network the user is not transacting on.
      enabled: Boolean(address) && chainId === arcTestnet.id,
    },
  });

  const connectors = useMemo<WalletConnector[]>(
    () =>
      available.map((connector: Connector) => ({
        id: connector.id,
        name: connector.name,
        pending: isPending && variables?.connector === connector,
        connect: () => connect({ connector, chainId: arcTestnet.id }),
      })),
    [available, connect, isPending, variables],
  );

  const switchToArc = useCallback(
    () => switchChain({ chainId: arcTestnet.id }),
    [switchChain],
  );

  const signMessage = useCallback(
    (message: string) => signMessageAsync({ message }),
    [signMessageAsync],
  );

  const error = connectError?.message ?? switchError?.message ?? null;

  return {
    address,
    shortAddress: address ? shortenAddress(address) : null,
    isConnected,
    isConnecting: isConnecting || isPending,
    isReconnecting,
    connectors,
    disconnect,
    chainId,
    isWrongNetwork: isConnected && chainId !== undefined && chainId !== arcTestnet.id,
    switchToArc,
    isSwitching,
    balance: balanceData
      ? `${Number(balanceData.formatted).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${balanceData.symbol}`
      : undefined,
    error,
    signMessage,
    isSigning,
  };
}
