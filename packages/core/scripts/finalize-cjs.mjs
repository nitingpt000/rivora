import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Marks `dist/` as CommonJS.
 *
 * The package itself is `"type": "module"`, so Node would otherwise read the
 * emitted `.js` files as ESM and fail on their `require` calls. A nested
 * package.json overrides the module type for that directory — the standard
 * way to ship a CJS build from an ESM package without renaming every file to
 * `.cjs`, which `tsc` cannot do.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

writeFileSync(join(dist, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);

console.log('core: marked dist/ as commonjs');
