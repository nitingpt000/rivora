import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest, matching the rest of the workspace, rather than the Jest setup the
 * Nest CLI scaffolds.
 *
 * The one thing that makes this work is SWC. Vitest transforms TypeScript with
 * esbuild, which does not implement `emitDecoratorMetadata` — so Nest's
 * `design:paramtypes` would be missing and every constructor-injected
 * dependency would resolve to `Object`. SWC does implement it, and swapping
 * the transform is cheaper than running a second test runner in one repo.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/openapi.ts', 'src/**/*.module.ts'],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
