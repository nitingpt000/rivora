import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { keccak256, toHex } from 'viem';
import 'dotenv/config';

/**
 * Shared plumbing for the Circle deployment scripts.
 *
 * Deploying through Circle's Smart Contract Platform rather than a local
 * signer means the deployer key lives inside Circle and never reaches this
 * machine. The trade is more moving parts: an entity secret, a wallet set, a
 * developer-controlled wallet, and a deployment that is asynchronous.
 */

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Circle's identifier for the chain. Not the numeric chain id. */
export const BLOCKCHAIN = 'ARC-TESTNET';
export const CHAIN_ID = 5042002;
export const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.io';
export const EXPLORER = 'https://testnet.arcscan.app';

/**
 * Reads a required variable, or stops with an instruction rather than a stack
 * trace. A missing API key is a setup step somebody has not done yet, not a
 * bug, and should read like one.
 */
export function required(name, hint) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  ${name} is not set in contracts/.env.\n\n  ${hint}\n`);
    process.exit(1);
  }
  return value;
}

/**
 * Loads a compiled contract's ABI and bytecode from Foundry's output.
 *
 * Read straight from `out/` rather than pasted, so what gets deployed is
 * exactly what the tests ran against.
 */
export function artifact(name) {
  const path = join(ROOT, 'out', `${name}.sol`, `${name}.json`);

  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(
      `\n  Could not read ${path}.\n\n  Build the contracts first:\n    pnpm --filter @rivora/contracts build\n`,
    );
    process.exit(1);
  }

  const bytecode = raw.bytecode?.object;
  if (!bytecode || bytecode === '0x') {
    console.error(`\n  ${name} has no deployable bytecode. Is it an interface or a library?\n`);
    process.exit(1);
  }

  return { abi: raw.abi, bytecode };
}

/** Role ids, matching the constants in the contracts. */
export const ROLES = {
  // OpenZeppelin's AccessControl uses bytes32(0) for the admin role.
  DEFAULT_ADMIN_ROLE: `0x${'0'.repeat(64)}`,
  CREDIT_MANAGER_ROLE: keccakConst('CREDIT_MANAGER_ROLE'),
  UNDERWRITER_ROLE: keccakConst('UNDERWRITER_ROLE'),
  RISK_ROLE: keccakConst('RISK_ROLE'),
  KEEPER_ROLE: keccakConst('KEEPER_ROLE'),
};

/**
 * `keccak256("ROLE_NAME")`, computed rather than hard-coded.
 *
 * A transcribed hash that is one character wrong grants a role nobody holds,
 * and the failure surfaces much later as an unexplained permission error.
 */
function keccakConst(name) {
  return keccak256(toHex(name));
}

/** Polls an async Circle operation until it settles. */
export async function waitFor(label, poll, { attempts = 60, intervalMs = 5_000 } = {}) {
  process.stdout.write(`  ${label} `);

  for (let i = 0; i < attempts; i += 1) {
    const result = await poll();
    if (result.done) {
      process.stdout.write(` ${result.ok ? 'ok' : 'failed'}\n`);
      return result;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  process.stdout.write(' timed out\n');
  return { done: false, ok: false };
}

export function explorerAddress(address) {
  return `${EXPLORER}/address/${address}`;
}
