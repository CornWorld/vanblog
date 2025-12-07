import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  eslint.configs.recommended,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
      '.nano-staged.js',
      '.prettierrc.js',
      '.versionrc.js',
      'eslint.config.js',
      'docs/.vuepress/**',
      'packages/admin/config/**',
      'packages/server/dist/**',
      'packages/shared/dist/**',
      'packages/server-ng/test-data/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // 必须修复的错误
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off',
      'prettier/prettier': 'error',

      // 禁用需要 parserOptions.project 的规则
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-destructuring': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**', '**/*.fixtures.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'prefer-destructuring': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
);
