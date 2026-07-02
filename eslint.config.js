// Flat config: lint .astro files for parse-level issues (the main thing
// we want — catching stray template characters, unclosed braces, broken
// JSX in frontmatter). Stylistic rules intentionally not enforced.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      // Astro inline scripts are vanilla JS, often use `any` for pb records
      // and DOM event targets. Don't fight the type system in this codebase.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Frontmatter consts used only in JSX are picked up as "unused" by
      // TS but consumed by the Astro compiler.
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/.astro/**', '**/node_modules/**'],
  },
];
