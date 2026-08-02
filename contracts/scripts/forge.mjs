import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Runs a Foundry command, or skips with an actionable message.
 *
 * The Solidity toolchain is not an npm dependency, so a contributor who only
 * touches the frontend will not have it. Two bad options were available:
 * fail the whole monorepo build for them, or fail cryptically with
 * "'forge' is not recognized". This does neither — it explains what is
 * missing, how to get it, and exits successfully so the JavaScript workspace
 * still builds.
 *
 * CI must install Foundry. A skipped contract test suite that nobody notices
 * is exactly how a Solidity regression reaches a deployment, so the warning is
 * loud and names the consequence.
 */
const [command, ...args] = process.argv.slice(2);

/** Foundry's default install location, which foundryup does not add to PATH
 *  on every shell. Checked so a local install works without extra setup. */
const fallbackBin = join(homedir(), '.foundry', 'bin');
const path = existsSync(fallbackBin)
  ? `${fallbackBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`
  : process.env.PATH;

const probe = spawnSync('forge', ['--version'], { shell: true, env: { ...process.env, PATH: path } });

if (probe.status !== 0) {
  console.warn(
    [
      '',
      '  ⚠  Foundry not found — skipping the contract task.',
      '',
      '     The Solidity tests did NOT run. Install Foundry to run them:',
      '       curl -L https://foundry.paradigm.xyz | bash && foundryup',
      '',
      '     CI is expected to have it; a skipped suite here is not a pass.',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

const result = spawnSync('forge', [command, ...args], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PATH: path },
});

process.exit(result.status ?? 1);
