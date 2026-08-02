'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { getWagmiConfig } from './config';

/**
 * Wallet and query context for the whole app.
 *
 * The `QueryClient` is created in state rather than at module scope so it is
 * never shared between requests during SSR — a module-level client would leak
 * one user's cached data into another's render.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Protocol state changes on settlement, not per second. A short
            // stale window keeps navigation instant without serving figures
            // that are visibly out of date.
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
