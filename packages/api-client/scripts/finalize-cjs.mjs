import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Marks `dist/` as CommonJS.
 *
 * The package is `"type": "module"`, so Node would otherwise read the emitted
 * `.js` files as ESM and fail on their `require` calls. A nested package.json
 * overrides the module type for that directory.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

writeFileSync(join(dist, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);

console.log('api-client: marked dist/ as commonjs');
