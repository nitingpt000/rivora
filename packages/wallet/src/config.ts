import { cookieStorage, createConfig, createStorage, http, type CreateConnectorFn } from 'wagmi';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

import { ARC_RPC_URL, arcTestnet } from './chain';

const WALLETCONNECT_PROJECT_ID =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID : undefined) ??
  '';

/**
 * Connectors, in the order the connect screen lists them.
 *
 * WalletConnect is included only when a project id is configured: instantiating
 * it without one throws at module load and takes the whole app down, which is a
 * poor trade for a connector nobody can use anyway. Injected wallets and
 * Coinbase work with no configuration, so a fresh clone connects out of the box.
 */
function connectors(): CreateConnectorFn[] {
  // Widened explicitly: each connector factory returns its own provider-shaped
  // type, and an inferred array would refuse the third push.
  const list: CreateConnectorFn[] = [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'Rivora', preference: 'all' }),
  ];

  if (WALLETCONNECT_PROJECT_ID) {
    list.push(
      walletConnect({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: 'Rivora',
          description: 'Stablecoin-native credit protocol for machine businesses',
          url: 'https://rivora.finance',
          icons: [],
        },
        showQrModal: true,
      }),
    );
  }

  return list;
}

/**
 * Built lazily and memoised.
 *
 * `createConfig` touches browser globals through its connectors, so building it
 * at module scope would run during the server render of any file that imports
 * it. Creating it on first use keeps the import side-effect free.
 */
let cached: ReturnType<typeof build> | null = null;

function build() {
  return createConfig({
    chains: [arcTestnet],
    connectors: connectors(),
    // Cookie-backed so the server render and the first client render agree on
    // connection state; without it every reload flashes a disconnected header.
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [arcTestnet.id]: http(ARC_RPC_URL),
    },
  });
}

export function getWagmiConfig() {
  if (!cached) cached = build();
  return cached;
}

export type WagmiConfig = ReturnType<typeof getWagmiConfig>;

/** True when a WalletConnect project id is configured. */
export const hasWalletConnect = WALLETCONNECT_PROJECT_ID.length > 0;
