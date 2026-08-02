import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config for every package in the monorepo.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: { turbo: turboPlugin },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Build scripts and config files run in Node, not the browser.
    files: ['**/*.config.{js,mjs,ts}', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    ignores: ['dist/**', '.next/**', '.turbo/**', 'node_modules/**'],
  },
];

export default baseConfig;
