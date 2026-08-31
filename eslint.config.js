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
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Frontmatter consts used only in JSX are picked up as "unused" by
      // TS but consumed by the Astro compiler.
      "no-unused-vars": "off",
      // Astro script blocks lint under virtual filenames; ternary statement
      // style and deliberate empty catches are accepted codebase-wide.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Browser-runtime files (app/theme frontmatter & inline scripts, pack
  // frontend) — document/window/console etc. are runtime globals.
  {
    files: ["app/src/**", "themes/*/src/**"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        self: "readonly",
        console: "readonly",
        location: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        AbortController: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        history: "readonly",
        matchMedia: "readonly",
        alert: "readonly",
        confirm: "readonly",
      },
    },
    rules: {
      // Empty catch blocks are a common deliberate pattern in browser code
      // (best-effort DOM operations).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // theme-host runs under Node (container runtime), not the browser.
  {
    files: ["app/src/theme-host/**"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
  },
  // Astro template expressions ({cond && <div/>}) are idiomatic, not
  // unused expressions.
  {
    files: ["**/*.astro"],
    rules: {
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
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
    files: [
      "vault/pb_hooks/**/*.js",
      "packs/*/hooks/**/*.pb.js",
      "packs/*/migrations/*.js",
    ],
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
        migrate: "readonly",
        unmarshal: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off",
    },
  },
  // Node scripts (scripts/*.mjs, root config) — shebang + Node globals.
  // Without this, `console`/`process`/`Buffer` etc. trip no-undef because
  // they are runtime globals provided by Node, not declared in this file.
  {
    files: ["scripts/**/*.mjs", "*.mjs", "models.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
];
