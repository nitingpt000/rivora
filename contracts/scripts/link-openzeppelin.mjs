import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Links pnpm's OpenZeppelin into `lib/`, where Foundry can see it.
 *
 * OpenZeppelin is a pnpm dependency rather than a git submodule, so a single
 * `pnpm install` brings it in with everything else. (forge-std *is* a
 * submodule — it has no npm package.) But Foundry resolves sources relative to
 * the project root, and
 * `forge coverage` in particular cannot follow a path that escapes it. A link
 * inside `lib/` satisfies both.
 *
 * Idempotent, and safe to run on every build.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '..', 'node_modules', '@openzeppelin', 'contracts');
const link = join(root, 'lib', 'openzeppelin-contracts');

if (existsSync(link)) {
  process.exit(0);
}

if (!existsSync(target)) {
  console.error(
    'OpenZeppelin is not installed. Run `pnpm install` at the repository root first.',
  );
  process.exit(1);
}

mkdirSync(join(root, 'lib'), { recursive: true });

try {
  // `junction` is the Windows type that works without elevated privileges;
  // it is ignored on other platforms, which use a plain directory symlink.
  symlinkSync(target, link, 'junction');
  console.log('contracts: linked lib/openzeppelin-contracts');
} catch (cause) {
  console.error(`contracts: could not link OpenZeppelin — ${String(cause)}`);
  process.exit(1);
}
