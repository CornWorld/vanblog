import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.node,
    },
  },
  rules: {
    // Server-specific rules
  },
  ignores: ['node_modules/**', 'dist/**', 'build/**', '*.d.ts'],
});
