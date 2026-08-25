#!/usr/bin/env node
// Scaffold a new theme by cloning themes/base/.
//
// Usage:
//   node scripts/build/theme-init.mjs <new-theme-name>
//
// Behaviour:
//   - Validates <new-theme-name> against the Pack name grammar
//     (lowercase, digits, hyphen-separated) so it can later be used in
//     Docker build-args and URLs without escaping.
//   - Copies themes/base → themes/<new-theme-name>.
//   - Rewrites the copy's theme.json to the new name/label.
//   - Removes node_modules/ and dist/ from the copy (they will be
//     reinstalled by the workspace).
//   - Removes the screenshot.png reference from theme.json if absent.
//
// After running, you can `cd themes/<new-theme-name> && pnpm dev` to start
// hacking. Edit src/pages/* or src/base-overrides/* to customise.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DEFAULT_THEME = join(REPO_ROOT, 'themes', 'base');

function fail(msg) {
  console.error(`theme-init: ${msg}`);
  process.exit(1);
}

const name = process.argv[2];
if (!name) fail('missing theme name. Usage: node scripts/build/theme-init.mjs <name>');
if (!NAME_RE.test(name)) fail(`invalid theme name "${name}" (must match ${NAME_RE})`);

const dest = join(REPO_ROOT, 'themes', name);
if (existsSync(dest)) fail(`themes/${name}/ already exists`);
if (!existsSync(DEFAULT_THEME)) fail('themes/base/ missing — cannot scaffold');

console.log(`theme-init: copying themes/base → themes/${name}`);
try {
  cpSync(DEFAULT_THEME, dest, { recursive: true });
} catch (err) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  fail(`copy failed: ${err.message}`);
}

// Drop artifacts that the workspace will rebuild.
for (const sub of ['node_modules', 'dist', '.astro']) {
  const p = join(dest, sub);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

// Rewrite theme.json: new name, derived label, drop screenshot if missing.
const themeJsonPath = join(dest, 'theme.json');
let themeJson;
try {
  themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
} catch (err) {
  fail(`failed to parse ${themeJsonPath}: ${err.message}`);
}
themeJson.name = name;
themeJson.label = name;
if (!existsSync(join(dest, 'screenshot.png'))) delete themeJson.screenshot;
writeFileSync(themeJsonPath, JSON.stringify(themeJson, null, 2) + '\n');

console.log(`theme-init: ✓ themes/${name}/ ready`);
console.log('');
console.log('Next steps:');
console.log(`  cd themes/${name} && pnpm install`);
console.log(`  pnpm dev   # http://localhost:4321`);
console.log('');
console.log('Edit src/pages/* to replace the base pages, or add files');
console.log('under src/base-overrides/ to selectively replace base');
console.log('layouts / components / styles.');
