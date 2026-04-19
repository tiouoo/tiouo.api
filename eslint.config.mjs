import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        router: 'readonly',
        axios: 'readonly',
        cheerio: 'readonly',
        mailer: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'quote-props': ['error', 'as-needed'],
    },
  },
  pluginJs.configs.recommended,
];
