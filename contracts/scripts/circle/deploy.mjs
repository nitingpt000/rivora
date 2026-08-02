import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';
import { createPublicClient, http } from 'viem';

import {
  BLOCKCHAIN,
  CHAIN_ID,
  EXPLORER,
  ROLES,
  ROOT,
  RPC_URL,
  artifact,
  explorerAddress,
  required,
  waitFor,
} from './lib.mjs';

/**
 * Deploys the protocol through Circle's Smart Contract Platform.
 *
 * ## Why the deployer is the initial admin
 *
 * The role wiring — telling the vault which contract may fund draws, telling
 * the registry whose signature counts — can only be done by an account holding
 * `DEFAULT_ADMIN_ROLE`. Under SCP the deployer is a wallet Circle controls,
 * which is *not* the address that should end up owning the protocol.
 *
 * So the contracts are constructed with the deployer as admin, wired, and then
 * handed over: every role is granted to `PROTOCOL_ADMIN`, and the deployer
 * renounces its own. The deployer's privilege exists only for the length of
 * this script.
 *
 * An earlier version passed `PROTOCOL_ADMIN` directly and then tried to wire
 * the roles from the deployer, which cannot work — the deployer held nothing.
 * The contracts deployed and the grants failed, leaving a protocol that could
 * not fund a single draw.
 *
 * The handover is verified on-chain at the end rather than assumed. A
 * deployment that reports success while the deployer still holds admin is
 * worse than one that fails loudly.
 *
 *   pnpm --filter @rivora/contracts circle:deploy
 */

const apiKey = required('CIRCLE_API_KEY', 'Run `pnpm --filter @rivora/contracts circle:setup` first.');
const entitySecret = required('CIRCLE_ENTITY_SECRET', 'Run circle:setup first.');
const walletId = required('CIRCLE_WALLET_ID', 'Run circle:setup first.');
const deployer = required('CIRCLE_WALLET_ADDRESS', 'Run circle:setup first.');
const admin = required('PROTOCOL_ADMIN', 'Set the address that should own the protocol.');
const underwriter = required('UNDERWRITER_ADDRESS', 'Set the address that will sign assessments.');

const USDC = process.env.USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';

const contracts = initiateSmartContractPlatformClient({ apiKey, entitySecret });
const wallets = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
const chain = createPublicClient({ transport: http(RPC_URL) });

const FEE = { type: 'level', config: { feeLevel: 'MEDIUM' } };

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

async function assertFunded() {
  const balance = await chain.getBalance({ address: deployer });

  console.log(`Deployer ${deployer}`);
  console.log(`Balance  ${(Number(balance) / 1e18).toFixed(4)} USDC (native, 18dp)\n`);

  if (balance === 0n) {
    console.error(
      `  The deployer has no gas.\n\n  Fund it at https://faucet.circle.com (Arc Testnet):\n    ${deployer}\n`,
    );
    process.exit(1);
  }
}

async function deploy(name, constructorParameters) {
  const { abi, bytecode } = artifact(name);

  console.log(`Deploying ${name}`);

  const response = await contracts.deployContract({
    name: `Rivora ${name}`,
    description: 'Rivora protocol contract',
    blockchain: BLOCKCHAIN,
    walletId,
    abiJson: JSON.stringify(abi),
    bytecode,
    constructorParameters,
    fee: FEE,
  });

  const contractId = response.data?.contractId;
  if (!contractId) {
    console.error('  Circle returned no contract id.', JSON.stringify(response.data));
    process.exit(1);
  }

  const result = await waitFor('  confirming', async () => {
    const status = await contracts.getContract({ id: contractId });
    const contract = status.data?.contract;

    if (contract?.contractAddress) return { done: true, ok: true, address: contract.contractAddress };
    if (contract?.status === 'FAILED') return { done: true, ok: false };
    return { done: false };
  });

  if (!result.ok || !result.address) {
    console.error(
      `  ${name} did not deploy. See https://console.circle.com/smart-contracts/contracts\n`,
    );
    process.exit(1);
  }

  console.log(`  ${result.address}\n`);
  return result.address;
}

async function execute(label, contractAddress, abiFunctionSignature, parameters) {
  process.stdout.write(`  ${label}\n`);

  const response = await wallets.createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters: parameters,
    fee: FEE,
  });

  const id = response.data?.id;
  if (!id) {
    console.error('    Circle returned no transaction id.');
    process.exit(1);
  }

  const result = await waitFor('   ', async () => {
    const status = await wallets.getTransaction({ id });
    const state = status.data?.transaction?.state;

    if (state === 'COMPLETE' || state === 'CONFIRMED') return { done: true, ok: true };
    if (state === 'FAILED' || state === 'CANCELLED') {
      return { done: true, ok: false, reason: status.data?.transaction?.errorReason };
    }
    return { done: false };
  });

  if (!result.ok) {
    console.error(`    failed${result.reason ? `: ${result.reason}` : ''}\n`);
    process.exit(1);
  }
}

const grant = (label, target, role, account) =>
  execute(label, target, 'grantRole(bytes32,address)', [role, account]);

const renounce = (label, target, role) =>
  execute(label, target, 'renounceRole(bytes32,address)', [role, deployer]);

async function hasRole(address, role, account) {
  return chain.readContract({ address, abi: HAS_ROLE_ABI, functionName: 'hasRole', args: [role, account] });
}

// ── run ─────────────────────────────────────────────────────────────────────

console.log(`\nRivora → ${BLOCKCHAIN} (chain ${CHAIN_ID})\n`);
await assertFunded();

// The deployer is admin for now. Ownership moves to PROTOCOL_ADMIN below.
const vault = await deploy('RivoraCreditVault', [USDC, deployer]);
const registry = await deploy('RivoraRiskRegistry', [deployer]);
const manager = await deploy('RivoraCreditManager', [USDC, vault, registry, deployer]);

console.log('Wiring the contracts together');
// Without this the manager cannot fund a draw and every borrow reverts.
await grant('vault: CREDIT_MANAGER_ROLE → manager', vault, ROLES.CREDIT_MANAGER_ROLE, manager);
// Without this no assessment is accepted and no limit can ever be set.
await grant('registry: UNDERWRITER_ROLE → underwriter', registry, ROLES.UNDERWRITER_ROLE, underwriter);

console.log('\nHanding ownership to the protocol admin');
await grant('vault: DEFAULT_ADMIN_ROLE → admin', vault, ROLES.DEFAULT_ADMIN_ROLE, admin);
await grant('vault: RISK_ROLE → admin', vault, ROLES.RISK_ROLE, admin);
await grant('registry: DEFAULT_ADMIN_ROLE → admin', registry, ROLES.DEFAULT_ADMIN_ROLE, admin);
await grant('manager: DEFAULT_ADMIN_ROLE → admin', manager, ROLES.DEFAULT_ADMIN_ROLE, admin);
await grant('manager: RISK_ROLE → admin', manager, ROLES.RISK_ROLE, admin);
await grant('manager: KEEPER_ROLE → admin', manager, ROLES.KEEPER_ROLE, admin);

console.log('\nRenouncing the deployer’s privileges');
// Renounced last, and only after the admin holds everything — the reverse
// order would lock the protocol with nobody able to administer it.
await renounce('vault: RISK_ROLE', vault, ROLES.RISK_ROLE);
await renounce('vault: DEFAULT_ADMIN_ROLE', vault, ROLES.DEFAULT_ADMIN_ROLE);
await renounce('registry: DEFAULT_ADMIN_ROLE', registry, ROLES.DEFAULT_ADMIN_ROLE);
await renounce('manager: RISK_ROLE', manager, ROLES.RISK_ROLE);
await renounce('manager: KEEPER_ROLE', manager, ROLES.KEEPER_ROLE);
await renounce('manager: DEFAULT_ADMIN_ROLE', manager, ROLES.DEFAULT_ADMIN_ROLE);

// ── verify ──────────────────────────────────────────────────────────────────

console.log('\nVerifying the final state on-chain');

const checks = [
  ['vault  manager holds CREDIT_MANAGER_ROLE', vault, ROLES.CREDIT_MANAGER_ROLE, manager, true],
  ['reg    underwriter holds UNDERWRITER_ROLE', registry, ROLES.UNDERWRITER_ROLE, underwriter, true],
  ['vault  admin holds DEFAULT_ADMIN_ROLE', vault, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['reg    admin holds DEFAULT_ADMIN_ROLE', registry, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['mgr    admin holds DEFAULT_ADMIN_ROLE', manager, ROLES.DEFAULT_ADMIN_ROLE, admin, true],
  ['vault  deployer renounced admin', vault, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
  ['reg    deployer renounced admin', registry, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
  ['mgr    deployer renounced admin', manager, ROLES.DEFAULT_ADMIN_ROLE, deployer, false],
];

let failures = 0;
for (const [label, address, role, account, expected] of checks) {
  const actual = await hasRole(address, role, account);
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — expected ${expected}, got ${actual}`}`);
}

if (failures > 0) {
  console.error(`\n  ${failures} check(s) failed. The deployment is not usable as it stands.\n`);
  process.exit(1);
}

const record = {
  network: 'arc-testnet',
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  explorer: EXPLORER,
  deployedAt: new Date().toISOString(),
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

writeFileSync(
  join(ROOT, 'deployments', 'arc-testnet.json'),
  `${JSON.stringify(record, null, 2)}\n`,
);

console.log(`
Deployed and verified.

  Vault    ${explorerAddress(vault)}
  Manager  ${explorerAddress(manager)}
  Registry ${explorerAddress(registry)}

Add to apps/api/.env:

  CHAIN_MODE=arc
  CREDIT_VAULT_ADDRESS=${vault}
  CREDIT_MANAGER_ADDRESS=${manager}
  RISK_REGISTRY_ADDRESS=${registry}
`);
