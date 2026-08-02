import { baseConfig } from '@rivora/eslint-config/base';
import globals from 'globals';

/**
 * `.mjs`, unlike every other package's `.js`.
 *
 * This app is CommonJS — Nest's decorator metadata transform requires it — so
 * a `.js` config in a package without `"type": "module"` is parsed as CJS,
 * fails on its `import` statements, and only works by Node's slow reparse
 * fallback. The explicit extension states the format instead of relying on it.
 */
export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      /**
       * Off for this app only.
       *
       * A constructor-injected service appears in a type position, so the rule
       * wants `import type` for it. That would erase the class at compile time
       * and leave Nest's `design:paramtypes` metadata pointing at `Object`,
       * breaking dependency injection at runtime with an error that reads
       * nothing like its cause. The rule can account for this, but only under
       * type-aware linting, which the shared config does not enable.
       */
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', 'prisma/migrations/**'],
  },
];
