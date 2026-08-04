import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';
import { createPublicClient, http, keccak256, stringToBytes } from 'viem';

import { BLOCKCHAIN, CHAIN_ID, ROOT, RPC_URL, artifact, required, waitFor } from './lib.mjs';

/**
 * Deploys a Revenue Router for one borrower and points the manager at it.
 *
 * A router is per-borrower by construction — it carries that borrower's id
 * and their waterfall split — so this is deliberately not part of the
 * protocol deployment. It runs once per borrower onboarded.
 *
 * ## What this makes true
 *
 * Until a router exists, repayment happens *after* the borrower has the
 * money: they call `repay` and the protocol trusts them to. The router is
 * what makes repayment structural — settled revenue lands in it, and
 * `distributeRevenue` splits repayment, reserve and operating share before
 * the borrower's wallet sees any of it.
 *
 *   node scripts/circle/deploy-router.mjs <borrower-handle>
 *
 * The handle must match the API's exactly: the onchain id is
 * `keccak256(handle)`, and a mismatch produces a router bound to a borrower
 * the manager has never heard of.
 *
 * The manager's `setRevenueRouter` needs `RISK_ROLE`, which the deployer
 * renounced at deployment. So the final step is printed for the protocol
 * admin to run rather than attempted here — the deployer cannot do it, and
 * pretending otherwise would fail halfway with a router nobody points at.
 */
const handle = process.argv[2];
if (!handle) {
  console.error('\nUsage: node scripts/circle/deploy-router.mjs <borrower-handle>\n');
  process.exit(1);
}

const apiKey = required('CIRCLE_API_KEY', 'Run circle:setup first.');
const entitySecret = required('CIRCLE_ENTITY_SECRET', 'Run circle:setup first.');
const walletId = required('CIRCLE_WALLET_ID', 'Run circle:setup first.');
const deployer = required('CIRCLE_WALLET_ADDRESS', 'Run circle:setup first.');
const admin = required('PROTOCOL_ADMIN', 'Set the address that owns the protocol.');

const USDC = process.env.USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';
const DEPLOYMENTS = join(ROOT, 'deployments', 'arc-testnet.json');

const deployment = JSON.parse(readFileSync(DEPLOYMENTS, 'utf8'));
const vault = deployment.contracts.RivoraCreditVault;
const manager = deployment.contracts.RivoraCreditManager;

if (!vault || !manager) {
  console.error('\nThe vault and manager must be deployed first — run circle:deploy.\n');
  process.exit(1);
}

/**
 * Where the reserve share accumulates and where the borrower's remainder
 * goes. Both default to the protocol admin on testnet; a real deployment
 * gives each borrower their own operating wallet and the protocol its own
 * reserve account.
 */
const reserveAccount = process.env.RESERVE_ACCOUNT ?? admin;
const operatingWallet = process.env.OPERATING_WALLET ?? admin;
const repaymentBps = Number(process.env.REPAYMENT_BPS ?? 2_000);
const reserveBps = Number(process.env.RESERVE_BPS ?? 200);

const contracts = initiateSmartContractPlatformClient({ apiKey, entitySecret });
const wallets = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
const chain = createPublicClient({ transport: http(RPC_URL) });

const borrowerId = keccak256(stringToBytes(handle));

console.log(`\nRevenue Router → ${BLOCKCHAIN} (chain ${CHAIN_ID})`);
console.log(`Borrower  "${handle}"`);
console.log(`           ${borrowerId}`);
console.log(`Split      ${repaymentBps / 100}% repayment · ${reserveBps / 100}% reserve · ${(10_000 - repaymentBps - reserveBps) / 100}% operating\n`);

const balance = await chain.getBalance({ address: deployer });
if (balance === 0n) {
  console.error(`  The deployer has no gas. Fund ${deployer} at https://faucet.circle.com\n`);
  process.exit(1);
}

const { abi, bytecode } = artifact('RivoraRevenueRouter');

console.log('Deploying RivoraRevenueRouter');
/**
 * The Circle-side label, kept short and plain.
 *
 * SCP rejects a name carrying anything outside ASCII — handles are display
 * strings and the seeded one holds an ellipsis — and rejects a long one too,
 * both with the same bare `API parameter invalid` naming no field. The
 * borrower this router belongs to is recorded in `deployments/` and, more to
 * the point, in the immutable `borrowerId` the constructor takes, so the
 * Circle console label carries no weight.
 */
const response = await contracts.deployContract({
  name: 'Rivora RevenueRouter',
  description: 'Rivora protocol contract',
  blockchain: BLOCKCHAIN,
  walletId,
  abiJson: JSON.stringify(abi),
  bytecode,
  constructorParameters: [
    USDC,
    borrowerId,
    // Admin from the start: unlike the protocol contracts, nothing here needs
    // wiring by the deployer afterwards, so there is no reason for it to hold
    // privilege even briefly.
    admin,
    vault,
    manager,
    reserveAccount,
    operatingWallet,
    // uint256 arguments go as JSON numbers. Circle rejects decimal strings
    // for them with a bare `API parameter invalid` naming no field, which is
    // an expensive thing to learn twice.
    repaymentBps,
    reserveBps,
  ],
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
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
  console.error('  Deployment failed. See https://console.circle.com/smart-contracts/contracts\n');
  process.exit(1);
}

console.log(`  ${result.address}\n`);

// Recorded before the manager knows about it: a router that exists but is not
// yet bound is a state worth being able to see.
deployment.routers = deployment.routers ?? {};
deployment.routers[handle] = {
  address: result.address,
  borrowerId,
  repaymentBps,
  reserveBps,
  reserveAccount,
  operatingWallet,
  boundToManager: false,
};
writeFileSync(DEPLOYMENTS, `${JSON.stringify(deployment, null, 2)}\n`);
console.log(`Recorded in deployments/arc-testnet.json\n`);

console.log('One step remains, and it needs the protocol admin:\n');
console.log('  The manager must be pointed at this router. setRevenueRouter is');
console.log('  RISK_ROLE-only and the deployer renounced that at deployment, so');
console.log(`  run this from ${admin}:\n`);
console.log(
  `  cast send ${manager} \\\n    "setRevenueRouter(bytes32,address)" \\\n    ${borrowerId} ${result.address} \\\n    --rpc-url ${RPC_URL} --account rivora-admin\n`,
);
console.log('  Then set boundToManager: true in deployments/arc-testnet.json.\n');
