import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createPublicClient, http } from 'viem';

import { CHAIN_ID, EXPLORER, ROLES, ROOT, RPC_URL, explorerAddress, required } from './lib.mjs';

/**
 * Checks a deployment's roles and records it.
 *
 * Split out of `deploy.mjs` so a rate-limited verification does not mean
 * redeploying. The public Arc RPC caps request rate, and the previous run hit
 * it partway through the checks — the contracts were fine, the reading of them
 * was not.
 *
 *   node scripts/circle/verify.mjs <vault> <manager> <registry>
 */

const [vault, manager, registry] = process.argv.slice(2);

if (!vault || !manager || !registry) {
  console.error(`
  Usage: node scripts/circle/verify.mjs <vault> <manager> <registry>

  Find the addresses with:
    pnpm --filter @rivora/contracts circle:status
`);
  process.exit(1);
}

const deployer = required('CIRCLE_WALLET_ADDRESS', 'Run circle:setup first.');
const admin = required('PROTOCOL_ADMIN', 'Set the protocol admin address.');
const underwriter = required('UNDERWRITER_ADDRESS', 'Set the underwriter address.');
const USDC = process.env.USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';

const chain = createPublicClient({ transport: http(RPC_URL) });

const HAS_ROLE_ABI = [
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

/**
 * Reads with backoff, and paced.
 *
 * The public RPC returns `-32011 request limit reached` under a burst. Sixteen
 * checks fired back to back is a burst, so each is spaced and retried.
 */
async function hasRole(address, role, account, attempt = 0) {
  try {
    return await chain.readContract({
      address,
      abi: HAS_ROLE_ABI,
      functionName: 'hasRole',
      args: [role, account],
    });
  } catch (cause) {
    const limited = String(cause).includes('request limit');
    if (!limited || attempt >= 5) throw cause;

    const wait = 2_000 * 2 ** attempt;
    process.stdout.write(` (rate limited, retrying in ${wait / 1000}s)`);
    await new Promise((r) => setTimeout(r, wait));
    return hasRole(address, role, account, attempt + 1);
  }
}

const checks = [
  ['manager holds CREDIT_MANAGER_ROLE on the vault', vault, ROLES.CREDIT_MANAGER_ROLE, manager, true],
  ['underwriter holds UNDERWRITER_ROLE', registry, ROLES.UNDERWRITER_ROLE, underwriter, true],
  ['admin holds DEFAULT_ADMIN_ROLE on the vault', vault, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['admin holds RISK_ROLE on the vault', vault, ROLES.RISK_ROLE, admin, true],
  ['admin holds DEFAULT_ADMIN_ROLE on the registry', registry, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['admin holds DEFAULT_ADMIN_ROLE on the manager', manager, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['admin holds RISK_ROLE on the manager', manager, ROLES.RISK_ROLE, admin, true],
  ['admin holds KEEPER_ROLE on the manager', manager, ROLES.KEEPER_ROLE, admin, true],
  ['deployer renounced admin on the vault', vault, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
  ['deployer renounced RISK on the vault', vault, ROLES.RISK_ROLE, deployer, false],
  ['deployer renounced admin on the registry', registry, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
  ['deployer renounced admin on the manager', manager, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
  ['deployer renounced RISK on the manager', manager, ROLES.RISK_ROLE, deployer, false],
  ['deployer renounced KEEPER on the manager', manager, ROLES.KEEPER_ROLE, deployer, false],
];

console.log(`\nVerifying on Arc testnet (chain ${CHAIN_ID})\n`);

let failures = 0;
for (const [label, address, role, account, expected] of checks) {
  process.stdout.write(`  ${label}`);
  const actual = await hasRole(address, role, account);
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(` ${ok ? '✓' : `✗ expected ${expected}, got ${actual}`}`);
  // Paced deliberately; the public endpoint is shared.
  await new Promise((r) => setTimeout(r, 400));
}

if (failures > 0) {
  console.error(`\n  ${failures} check(s) failed. This deployment is not usable as it stands.\n`);
  process.exit(1);
}

const record = {
  network: 'arc-testnet',
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  explorer: EXPLORER,
  verifiedAt: new Date().toISOString(),
  deployedVia: 'circle-smart-contract-platform',
  deployer,
  admin,
  underwriter,
  contracts: {
    usdc: USDC,
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    gatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    RivoraCreditVault: vault,
    RivoraCreditManager: manager,
    RivoraRiskRegistry: registry,
  },
};

writeFileSync(join(ROOT, 'deployments', 'arc-testnet.json'), `${JSON.stringify(record, null, 2)}\n`);

console.log(`
All ${checks.length} checks passed. Recorded in contracts/deployments/arc-testnet.json

  Vault    ${explorerAddress(vault)}
  Manager  ${explorerAddress(manager)}
  Registry ${explorerAddress(registry)}

Add to apps/api/.env:

  CHAIN_MODE=arc
  CREDIT_VAULT_ADDRESS=${vault}
  CREDIT_MANAGER_ADDRESS=${manager}
  RISK_REGISTRY_ADDRESS=${registry}
`);
