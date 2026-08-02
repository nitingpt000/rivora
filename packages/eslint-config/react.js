import globals from 'globals';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

import { baseConfig } from './base.js';

/** @type {import("eslint").Linter.Config[]} */
export const reactConfig = [
  ...baseConfig,
  pluginReact.configs.flat.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': pluginReactHooks },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React 17+ automatic runtime — no React import needed.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];

export default reactConfig;
