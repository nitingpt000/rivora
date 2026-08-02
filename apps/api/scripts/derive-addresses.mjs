/**
 * Prints the addresses behind the deterministic development keys.
 *
 * These are the well-known Anvil/Hardhat test keys — public, published in
 * every Ethereum tutorial, and holding nothing. They exist so the seeded
 * database can be signed into: an address invented for display cannot
 * authenticate, and a developer cannot test a login they have no key for.
 *
 * Never use these anywhere that holds value.
 */
import { privateKeyToAccount } from 'viem/accounts';

export const DEV_KEYS = {
  borrower: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  lp: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ops: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  partner: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
};

for (const [role, key] of Object.entries(DEV_KEYS)) {
  console.log(`${role.padEnd(9)} ${privateKeyToAccount(key).address.toLowerCase()}`);
}
