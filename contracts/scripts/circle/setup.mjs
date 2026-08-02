import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  initiateDeveloperControlledWalletsClient,
  registerEntitySecretCiphertext,
} from '@circle-fin/developer-controlled-wallets';

import { BLOCKCHAIN, ROOT, explorerAddress, required } from './lib.mjs';

/**
 * One-time Circle setup: entity secret, wallet set, deployer wallet.
 *
 * Idempotent. Each step is skipped if `contracts/.env` already records its
 * result, so re-running after a failure resumes rather than starting over —
 * which matters because registering a second entity secret invalidates the
 * first, and that is not a mistake worth making twice.
 *
 *   pnpm --filter @rivora/contracts circle:setup
 */

const ENV_PATH = join(ROOT, '.env');

function setEnv(key, value) {
  const line = `${key}=${value}`;
  const current = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';

  if (new RegExp(`^${key}=.*$`, 'm').test(current)) {
    writeFileSync(ENV_PATH, current.replace(new RegExp(`^${key}=.*$`, 'm'), line));
  } else {
    appendFileSync(ENV_PATH, `${current.endsWith('\n') || !current ? '' : '\n'}${line}\n`);
  }

  process.env[key] = value;
}

const apiKey = required(
  'CIRCLE_API_KEY',
  'Create one at https://console.circle.com → API & Client Keys → Create a key → API Key.\n  Restricted Access with Contracts and Wallets read/write is enough.',
);

// ── 1. Entity secret ────────────────────────────────────────────────────────

let entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (entitySecret) {
  console.log('\n1. Entity secret — already set, skipping registration.');
} else {
  console.log('\n1. Entity secret — generating and registering.');

  // 32 bytes from the CSPRNG. This is the key that authorises every wallet
  // operation; it is generated here and Circle only ever sees its ciphertext.
  entitySecret = randomBytes(32).toString('hex');

  // A directory, not a filename — the SDK appends its own `recovery_file_<id>.dat`.
  const recoveryDir = join(ROOT, 'recovery');
  mkdirSync(recoveryDir, { recursive: true });

  /**
   * Persist before the network call, not after.
   *
   * Registration and the recovery-file write are separate steps inside the
   * SDK. If the first succeeds and the second throws, Circle is holding a
   * secret this machine no longer knows — unrecoverable, because Circle does
   * not store it either. Writing it first makes that outcome merely awkward.
   */
  setEnv('CIRCLE_ENTITY_SECRET', entitySecret);

  try {
    await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      recoveryFileDownloadPath: recoveryDir,
    });
    console.log(`   registered. recovery file written to ${recoveryDir}`);
    console.log('   Circle cannot regenerate it. Back it up somewhere else.');
  } catch (cause) {
    console.error(`
   Registration failed: ${cause instanceof Error ? cause.message : String(cause)}

   The generated secret has been saved to contracts/.env so it is not lost.
   If Circle did register it, you are in sync and can re-run this script.
   If it did not, clear CIRCLE_ENTITY_SECRET from contracts/.env and retry.
`);
    process.exit(1);
  }
}

const wallets = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

// ── 2. Wallet set ───────────────────────────────────────────────────────────

let walletSetId = process.env.CIRCLE_WALLET_SET_ID;

if (walletSetId) {
  console.log('2. Wallet set — already set, skipping.');
} else {
  console.log('2. Wallet set — creating.');
  const response = await wallets.createWalletSet({ name: 'Rivora Protocol' });
  walletSetId = response.data?.walletSet?.id ?? '';

  if (!walletSetId) {
    console.error('   Circle returned no wallet set id.');
    process.exit(1);
  }

  setEnv('CIRCLE_WALLET_SET_ID', walletSetId);
  console.log(`   ${walletSetId}`);
}

// ── 3. Deployer wallet ──────────────────────────────────────────────────────

let walletId = process.env.CIRCLE_WALLET_ID;
let walletAddress = process.env.CIRCLE_WALLET_ADDRESS;

if (walletId && walletAddress) {
  console.log('3. Deployer wallet — already set, skipping.');
} else {
  console.log('3. Deployer wallet — creating on', BLOCKCHAIN);
  const response = await wallets.createWallets({
    blockchains: [BLOCKCHAIN],
    count: 1,
    walletSetId,
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    console.error('   Circle returned no wallet.');
    process.exit(1);
  }

  walletId = wallet.id;
  walletAddress = wallet.address;

  setEnv('CIRCLE_WALLET_ID', walletId);
  setEnv('CIRCLE_WALLET_ADDRESS', walletAddress);
  console.log(`   ${walletAddress}`);
}

console.log(`
Setup complete. Everything was written to contracts/.env.

  Deployer wallet  ${walletAddress}
                   ${explorerAddress(walletAddress)}

This is a NEW wallet that Circle controls, not one of the addresses you funded
earlier — those were the admin and underwriter, which only need to receive
roles, not pay gas.

  Next: fund it at https://faucet.circle.com (Arc Testnet), then

    pnpm --filter @rivora/contracts circle:deploy
`);
