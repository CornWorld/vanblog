/**
 * ESLint configuration for @vanblog/server-ng
 *
 * Uses strictTypeChecked preset for NestJS backend.
 * Only adds rules not covered by the preset.
 */
import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  eslint.configs.recommended,

  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'test-data/**'],
  },

  // TypeScript with strictTypeChecked preset
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
    },
    rules: {
      // Override preset defaults
      '@typescript-eslint/no-extraneous-class': 'off', // NestJS modules
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-useless-default-assignment': 'off', // Zod schema inference issue

      // Additional strict rules (not in preset)
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',

      // Import ordering
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
      'import/no-duplicates': 'error',

      // Restrict direct libsql imports
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'drizzle-orm/libsql', message: '使用 src/database/connection.ts' },
          { name: 'drizzle-orm/libsql/migrator', message: '迁移逻辑应在数据库层' },
        ],
      }],

      // Code style
      'prettier/prettier': 'error',
      'no-console': 'warn',
      'prefer-destructuring': ['error', { array: true, object: true }],
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },

  // Plugin files - use dynamic typing by design
  {
    files: [
      'plugins/**/*.ts',
      'src/modules/plugin/**/*.ts',
      'src/modules/shortcode/**/*.ts',
      '../shared/src/plugin/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off', // Plugin handlers use generic Function type
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-deprecated': 'off', // Using Zod internal APIs for compatibility
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/ban-types': 'off',
      'no-control-regex': 'off', // Shortcode service uses control chars in regex
      'no-useless-escape': 'off', // Shortcode regex has intentional escapes
      'prefer-destructuring': 'off', // Not always cleaner for array access
      'no-case-declarations': 'off', // Case blocks with declarations are fine
      'require-yield': 'off', // Generator for iterability protocol
      'import/no-duplicates': 'off', // Split imports for types vs values
      '@typescript-eslint/no-non-null-assertion': 'off', // Shortcode uses intentional assertions
    },
  },

  // File-specific overrides
  {
    files: ['src/shared/services/markdown.service.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'src/modules/admin/meta/meta.service.ts',
      'src/modules/auth/auth.module.ts',
      'src/modules/auth/token.service.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['src/database/connection.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/backup/backup.service.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/modules/user/user.controller.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      // Type safety relaxation for tests
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off', // Callbacks in test setup/teardown
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Type guards for testing
      '@typescript-eslint/explicit-function-return-type': 'off', // Implicit returns in test helpers
      '@typescript-eslint/no-unnecessary-condition': 'off', // Conditional tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Non-null assertions are safe in tests

      // Import and style relaxation
      'no-console': 'off',
      'no-restricted-imports': 'off',
      'import/order': 'off', // Test files often need special import order for mocking
      'prefer-destructuring': 'off', // Not always cleaner in test setup
    },
  },

  // JavaScript files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
    },
  },

  prettierConfig,
]);
