import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';

import { required } from './lib.mjs';

/**
 * Lists what has actually been deployed through Circle.
 *
 * Exists because a deployment that fails partway leaves contracts on-chain
 * that no local file records. Asking Circle is more reliable than reading back
 * a log, and far more reliable than assuming.
 *
 *   pnpm --filter @rivora/contracts circle:status
 */
const apiKey = required('CIRCLE_API_KEY', 'Run circle:setup first.');
const entitySecret = required('CIRCLE_ENTITY_SECRET', 'Run circle:setup first.');

const contracts = initiateSmartContractPlatformClient({ apiKey, entitySecret });

const response = await contracts.listContracts({ pageSize: 50 });
const list = response.data?.contracts ?? [];

if (list.length === 0) {
  console.log('\nNo contracts deployed through this Circle account.\n');
  process.exit(0);
}

console.log(`\n${list.length} contract(s), newest first:\n`);

for (const contract of list) {
  console.log(`  ${contract.name ?? '(unnamed)'}`);
  console.log(`    address   ${contract.contractAddress ?? '— not yet confirmed —'}`);
  console.log(`    status    ${contract.status}`);
  console.log(`    deployed  ${contract.deploymentTransaction?.createDate ?? contract.createDate ?? '?'}`);
  console.log('');
}
