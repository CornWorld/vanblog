// Flat config: lint .astro files for parse-level issues (the main thing
// we want — catching stray template characters, unclosed braces, broken
// JSX in frontmatter). Stylistic rules intentionally not enforced.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      // Astro inline scripts are vanilla JS, often use `any` for pb records
      // and DOM event targets. Don't fight the type system in this codebase.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      // Frontmatter consts used only in JSX are picked up as "unused" by
      // TS but consumed by the Astro compiler.
      "no-unused-vars": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.astro/**",
      "**/node_modules/**",
      "**/plugins/**",
      "vault/internal/validation/models.js",
    ],
  },
  // PB JSVM globals — available at runtime but not at lint time.
  // Hook modules intentionally use PocketBase JSVM/CommonJS conventions
  // (triple-slash local d.ts references, require/module.exports, empty catch
  // probes), so keep those rules relaxed only for PB hook files.
  {
    files: ["vault/pb_hooks/**/*.js", "packs/*/hooks/**/*.pb.js"],
    languageOptions: {
      globals: {
        $app: "readonly",
        $template: "readonly",
        $os: "readonly",
        $apis: "readonly",
        $dbx: "readonly",
        $security: "readonly",
        $filesystem: "readonly",
        $http: "readonly",
        $mails: "readonly",
        routerAdd: "readonly",
        routerUse: "readonly",
        onBootstrap: "readonly",
        onServe: "readonly",
        onRecordBeforeCreateRequest: "readonly",
        onRecordAfterCreateSuccess: "readonly",
        onRecordAfterUpdateSuccess: "readonly",
        onRecordAfterDeleteSuccess: "readonly",
        cronAdd: "readonly",
        cronRemove: "readonly",
        console: "readonly",
        require: "readonly",
        module: "readonly",
        Record: "readonly",
        Collection: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off",
    },
  },
];
