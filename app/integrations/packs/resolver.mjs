import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, normalize, relative } from 'node:path';

const PACK_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PUBLIC_PATH_PATTERN = /^\/p\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

// Allowed keys in pack.json. Go's packMetadata struct mirrors this list; keep
// them in sync. Any other key is rejected as a typo fail-closed.
const ALLOWED_PACK_JSON_KEYS = new Set(['name', 'version', 'title', 'nav', 'frontend']);

export function discoverPacks(root) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('Pack root must be a non-empty string');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readPack(root, entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// mergeLocalPacks applies whole-Pack replacement on top of builtin Packs, using
// the same semantics as the Go pack.Resolve: each local Pack directory whose
// pack.json name matches a builtin replaces it entirely; local Packs with no
// builtin counterpart are appended. The local root is optional; missing or empty
// roots return builtins untouched.
export function mergeLocalPacks(builtins, localRoot) {
  if (!localRoot || !existsSync(localRoot)) return builtins;
  const localByName = new Map();
  for (const pack of discoverPacks(localRoot)) {
    if (localByName.has(pack.name)) {
      throw new Error(`Duplicate local Pack ${pack.name} in ${localRoot}`);
    }
    localByName.set(pack.name, pack);
  }
  const resolved = [];
  const seen = new Set();
  for (const pack of builtins) {
    const override = localByName.get(pack.name);
    resolved.push(override ?? pack);
    seen.add(pack.name);
  }
  for (const pack of localByName.values()) {
    if (!seen.has(pack.name)) resolved.push(pack);
  }
  resolved.sort((a, b) => a.name.localeCompare(b.name));
  return resolved;
}

function readPack(root, directory) {
  const packDir = join(root, directory);
  const packJson = readPackJson(join(packDir, 'pack.json'), directory);
  if (packJson.name !== directory) throw new Error(`Pack directory ${directory} declares name ${packJson.name}`);
  const pageEntrypoint = join(packDir, 'pages', 'index.astro');
  return {
    name: packJson.name,
    version: packJson.version,
    title: packJson.title,
    nav: packJson.nav,
    frontend: packJson.frontend,
    directory: packDir,
    pages: existsSync(pageEntrypoint) ? [{ pack: packJson.name, page: 'index', entrypoint: pageEntrypoint }] : [],
  };
}

function readPackJson(path, directory) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (error) { throw new Error(`Failed to read Pack identity for ${directory}: ${error.message}`); }
  let json;
  try { json = JSON.parse(raw); }
  catch (error) { throw new Error(`Failed to parse pack.json for ${directory}: ${error.message}`); }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`Pack ${directory} pack.json must contain a JSON object`);
  }
  for (const key of Object.keys(json)) {
    if (!ALLOWED_PACK_JSON_KEYS.has(key)) {
      throw new Error(`Pack ${directory} pack.json contains unknown field ${key}; allowed: name, version, title, nav, frontend`);
    }
  }
  if (!PACK_NAME_PATTERN.test(json.name)) throw new Error(`Invalid Pack name: ${String(json.name)}`);
  if (!VERSION_PATTERN.test(json.version)) throw new Error(`Invalid Pack version for ${json.name}: ${String(json.version)}`);
  if (json.title !== undefined && (typeof json.title !== 'string' || json.title.length === 0)) {
    throw new Error(`Pack ${json.name} title must be a non-empty string when present`);
  }
  if (json.nav !== undefined) {
    if (!json.nav || typeof json.nav !== 'object' || Array.isArray(json.nav)) {
      throw new Error(`Pack ${json.name} nav must be an object`);
    }
    if (typeof json.nav.label !== 'string' || json.nav.label.length === 0) {
      throw new Error(`Pack ${json.name} nav.label must be a non-empty string`);
    }
    if (typeof json.nav.href !== 'string' || json.nav.href.length === 0) {
      throw new Error(`Pack ${json.name} nav.href must be a non-empty string`);
    }
  }
  if (json.frontend !== undefined) {
    // Structured validation of frontend styles/scripts paths happens in
    // resolveFrontendContribution below, because it needs filesystem access
    // to confirm the files exist. Here we only check the high-level shape.
    if (!json.frontend || typeof json.frontend !== 'object' || Array.isArray(json.frontend)) {
      throw new Error(`Pack ${json.name} frontend must be an object`);
    }
  }
  return json;
}

export function loadPackMetadata(packs) {
  return packs.map((pack) => {
    const frontend = resolveFrontendContribution(pack, pack.frontend);
    const title = typeof pack.title === 'string' && pack.title.length > 0 ? pack.title : pack.name;
    const route = `/p/${pack.name}`;
    const nav = pack.nav && typeof pack.nav === 'object'
      ? { label: typeof pack.nav.label === 'string' && pack.nav.label.length > 0 ? pack.nav.label : title, href: pack.nav.href === route ? pack.nav.href : route }
      : null;
    return { name: pack.name, version: pack.version, title, nav, routes: pack.pages.map((page) => ({ pattern: `/p/${page.pack}`, page: page.page })), ...(frontend ? { frontend } : {}) };
  });
}

function resolveFrontendContribution(pack, contribution) {
  if (contribution === undefined) return null;
  if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) throw new Error(`Pack ${pack.name} frontend contribution must be an object`);
  if (contribution.scope !== 'public') throw new Error(`Pack ${pack.name} frontend scope must be public`);
  const styles = validateFrontendPaths(pack, contribution.styles, 'styles');
  const scripts = validateFrontendPaths(pack, contribution.scripts, 'scripts');
  if (styles.length === 0 && scripts.length === 0) throw new Error(`Pack ${pack.name} frontend contribution is empty`);
  return { scope: 'public', styles, scripts };
}

function validateFrontendPaths(pack, values, field) {
  if (!Array.isArray(values)) throw new Error(`Pack ${pack.name} frontend ${field} must be an array`);
  const seen = new Set();
  return values.map((value) => {
    if (typeof value !== 'string' || value.length === 0 || isAbsolute(value) || value.includes('\0')) throw new Error(`Pack ${pack.name} frontend ${field} contains an invalid path`);
    const normalized = normalize(value);
    const frontendRoot = join(pack.directory, 'frontend');
    const target = join(frontendRoot, normalized);
    if (relative(frontendRoot, target).startsWith('..') || normalized !== value || !existsSync(target)) throw new Error(`Pack ${pack.name} frontend ${field} path must be an existing file under frontend/: ${value}`);
    if (seen.has(value)) throw new Error(`Pack ${pack.name} frontend ${field} contains duplicate path: ${value}`);
    seen.add(value);
    return value;
  });
}

export function resolvePublicPages(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError('Pack page definitions must be an array');
  const seenPacks = new Set();
  const seenPaths = new Set();
  return definitions.map((definition) => {
    if (!definition || typeof definition !== 'object') throw new TypeError('Each Pack page definition must be an object');
    const { pack, page, entrypoint } = definition;
    if (!PACK_NAME_PATTERN.test(pack)) throw new Error(`Invalid Pack name: ${String(pack)}`);
    if (page !== 'index') throw new Error(`Unsupported public page for Pack ${pack}: ${String(page)}`);
    if (typeof entrypoint !== 'string' || entrypoint.length === 0) throw new Error(`Missing entrypoint for Pack ${pack}`);
    const pattern = `/p/${pack}`;
    const namespaceMatch = PUBLIC_PATH_PATTERN.exec(pattern);
    if (!namespaceMatch || namespaceMatch[1] !== pack) throw new Error(`Public page must use the /p/<pack> namespace: ${pattern}`);
    if (seenPacks.has(pack) || seenPaths.has(pattern)) throw new Error(`Duplicate public Pack page: ${pattern}`);
    seenPacks.add(pack); seenPaths.add(pattern);
    return { pack, page, pattern, entrypoint };
  });
}
