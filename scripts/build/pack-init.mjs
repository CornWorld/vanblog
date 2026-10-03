// pack-init: scaffold a new Pack directory (pack.json + optional skeletons).
// Mirrors scripts/build/theme-init.mjs: host-side authoring tool, runs from
// anywhere (anchored on this file), refuses to overwrite, validates the name
// against the shared grammar.
//
//   node scripts/build/pack-init.mjs my-pack [dest-dir]
//
// dest-dir defaults to <repo-root>/<name>; pass another path to scaffold
// elsewhere (e.g. a staging folder you install by copying into
// VANBLOG_PACKS_DIR or via `vanblog.sh pack add`).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fail, workspaceRoot } from '../lib/js/common.mjs';

const REPO_ROOT = workspaceRoot();
const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TEMPLATE = new URL('../pack-template/', import.meta.url);

const name = process.argv[2];
if (!name) fail('missing pack name. Usage: node scripts/build/pack-init.mjs <name> [dest-dir]');
if (!NAME_RE.test(name)) fail(`invalid pack name "${name}" (must match ${NAME_RE})`);

const dest = resolve(process.argv[3] || join(REPO_ROOT, name));
if (existsSync(dest)) fail(`${dest} already exists`);
if (!existsSync(TEMPLATE)) fail('scripts/pack-template/ missing — cannot scaffold');

console.log(`pack-init: copying scripts/pack-template → ${dest}`);
try {
  mkdirSync(dest, { recursive: true });
  cpSync(TEMPLATE, dest, { recursive: true });
} catch (err) {
  rmSync(dest, { recursive: true, force: true });
  fail(`copy failed: ${err.message}`);
}

// Substitute __NAME__ placeholders across the text skeletons and rename
// placeholder file names (hooks/__NAME__.pb.js → hooks/<name>.pb.js).
for (const entry of readdirSync(dest, { withFileTypes: true, recursive: true })) {
  if (entry.isDirectory()) continue;
  const p = join(entry.parentPath ?? join(dest), entry.name);
  const content = readFileSync(p, 'utf8');
  if (content.includes('__NAME__')) writeFileSync(p, content.replaceAll('__NAME__', name));
  if (entry.name.includes('__NAME__')) {
    writeFileSync(join(entry.parentPath ?? dest, entry.name.replaceAll('__NAME__', name)), readFileSync(p, 'utf8'));
    rmSync(p);
  }
}

// Rewrite identity: name + placeholder version/title.
const packJsonPath = join(dest, 'pack.json');
let packJson;
try {
  packJson = JSON.parse(readFileSync(packJsonPath, 'utf8'));
} catch (err) {
  fail(`failed to parse ${packJsonPath}: ${err.message}`);
}
packJson.name = name;
packJson.title = name;
packJson.version = '0.1.0';
writeFileSync(packJsonPath, JSON.stringify(packJson, null, 2) + '\n');

console.log(`pack-init: ✓ ${dest} ready`);
console.log('');
console.log('Layout (all optional except pack.json):');
console.log('  pack.json                 identity + nav + frontend contribution');
console.log('  pages/index.astro         public page at /p/<name> (build-time)');
console.log('  frontend/style.css        runtime-injected CSS (live, no rebuild)');
console.log('  frontend/script.js        runtime-injected JS module');
console.log('  frontend/<dir>/           static widget tree under /pack-static/<name>/');
console.log('  hooks/<name>.pb.js        JSVM hooks/routes (load on PB restart)');
console.log('  migrations/0001_init.js   PB collection DDL (runs at PB restart)');
console.log('');
console.log('Install: copy the dir into VANBLOG_PACKS_DIR, then restart the container');
console.log('so hooks/migrations load. See docs/reference/packs.md');
