import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Optional peers of `@coinbase/cdp-sdk` that are not installed. Listed
 * explicitly so adding one later is a deliberate edit rather than a silent
 * change in resolution behaviour. See the `webpack` hook below.
 */
const OPTIONAL_X402_PEERS = ['@x402/core', '@x402/evm', '@x402/extensions', '@x402/svm'];

const nextConfig: NextConfig = {
  /**
   * Pin file tracing to the monorepo root. Without it Next walks up until it
   * finds a lockfile and can settle on one outside the repo entirely.
   */
  outputFileTracingRoot: monorepoRoot,

  /**
   * Internal packages ship TypeScript source rather than a build artefact, so
   * Next compiles them in-place. No watch-and-rebuild step between editing a
   * component and seeing it, and one TypeScript config governs the whole repo.
   */
  transpilePackages: [
    '@rivora/api-client',
    '@rivora/core',
    '@rivora/nav',
    '@rivora/protocol-sim',
    '@rivora/tokens',
    '@rivora/ui',
    '@rivora/wallet',
  ],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@rivora/ui', '@rivora/core'],
  },

  /**
   * The `@x402/*` packages are *optional* peers of `@coinbase/cdp-sdk`, which
   * the Coinbase connector reaches through `@base-org/account`. None is
   * installed, because nothing here signs x402 payments through a CDP smart
   * account — but webpack has no notion of an optional peer and fails the
   * production build on the unresolved imports. Turbopack (dev) resolves them
   * lazily and never notices.
   *
   * Aliasing each to `false` gives webpack the empty module that "optional and
   * absent" is supposed to mean; the alias covers subpaths, so
   * `@x402/evm/exact/client` resolves too. Install the real packages if that
   * signing path is ever genuinely needed.
   */
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(OPTIONAL_X402_PEERS.map((name) => [name, false as const])),
    };
    return config;
  },
};

export default nextConfig;
