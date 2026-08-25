// Shared JS utilities for vanblog dev scripts (moved under scripts/lib/js/ in the
// audience-layered restructure). Extracted only from capabilities that were
// actually duplicated across two or more existing scripts — nothing invented.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

// Repo root: lib/js sits at scripts/lib/js/common.mjs, three levels below root.
export const REPO_ROOT = resolve(new URL('../../..', import.meta.url).pathname);

/**
 * Workspace root shared by all scripts, in both environments:
 *  - dev container: VANBLOG_WORKSPACE=/workspace (entrypoint.dev.sh exports it)
 *  - source checkout: derived from this file's location (scripts/lib/js → ../../)
 * Env-first so the container layout wins wherever it is set; the derivation is
 * only a fallback so running from a checkout never points at a stale /workspace.
 */
export function workspaceRoot() {
  return process.env.VANBLOG_WORKSPACE ?? REPO_ROOT;
}

/**
 * Recursively list all files under dir, returning '/' -relative paths.
 * Mirrors the walk in doc-dup-check.mjs / override-check.mjs.
 */
export function walk(dir, prefix = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // missing / unreadable → treat as empty
  }
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    } else {
      // symlink / special: resolve via stat
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) out.push(...walk(full, rel));
      else if (st.isFile()) out.push(rel);
    }
  }
  return out;
}

/** Print an error and exit 1 (pattern shared by theme-init.mjs / pack-schema-build.mjs). */
export function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/** Parse a UTF-8 JSON file. Throw propagates to the caller. */
export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Minimal `--opt <val>` CLI parser (defaults merged in). Handles `--opt val`,
 * `--opt=val`, and guards against an option accidentally eating the next token.
 * Spec: { optName: { alias?: 'x', default?: val, required?: bool } }.
 */
export function parseArgs(argv, spec) {
  const makeKey = (k) => k.replace(/^-+/, '').replace(/[=-]/g, '');
  const byName = new Map(
    Object.entries(spec).map(([name, def]) => [
      name,
      { ...def, name },
    ]),
  );
  const aliasToName = new Map(
    Object.entries(spec)
      .filter(([, def]) => def.alias)
      .map(([name, def]) => [def.alias, name]),
  );
  const args = {};
  const positional = [];
  for (const [name, def] of Object.entries(spec)) {
    if (def.default !== undefined) args[name] = def.default;
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('-')) {
      let key = arg;
      let value;
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        key = arg.slice(0, eq);
        value = arg.slice(eq + 1);
      }
      const k = makeKey(key);
      const def = byName.get(k) ?? byName.get(aliasToName.get(k) ?? '');
      if (!def) {
        fail(`Unknown option: ${arg}`);
      }
      if (value === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          fail(`Option ${key} requires a value`);
        }
        value = next;
        i++;
      }
      args[def.name] = value;
    } else {
      positional.push(arg);
    }
  }
  for (const [name, def] of byName) {
    if (def.required && !(name in args)) {
      fail(`Option --${name} is required`);
    }
  }
  args._ = positional;
  return args;
}