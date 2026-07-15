import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACK_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PUBLIC_PATH_PATTERN = /^\/p\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

export function discoverPacks(root) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('Pack root must be a non-empty string');
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readPack(root, entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readPack(root, directory) {
  const packDir = join(root, directory);
  const identity = readIdentity(join(packDir, 'pack.json'), directory);
  if (identity.name !== directory) throw new Error(`Pack directory ${directory} declares name ${identity.name}`);
  const pageEntrypoint = join(packDir, 'pages', 'index.astro');
  const metadataEntrypoint = join(packDir, 'pack.ts');
  return {
    ...identity,
    directory: packDir,
    pages: existsSync(pageEntrypoint)
      ? [{ pack: identity.name, page: 'index', entrypoint: pageEntrypoint }]
      : [],
    metadataEntrypoint: existsSync(metadataEntrypoint) ? metadataEntrypoint : null,
  };
}

function readIdentity(path, directory) {
  let identity;
  try {
    identity = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read Pack identity for ${directory}: ${error.message}`);
  }
  const keys = Object.keys(identity).sort();
  if (keys.join(',') !== 'name,version') throw new Error(`Pack ${directory} pack.json must contain only name and version`);
  if (!PACK_NAME_PATTERN.test(identity.name)) throw new Error(`Invalid Pack name: ${String(identity.name)}`);
  if (!VERSION_PATTERN.test(identity.version)) throw new Error(`Invalid Pack version for ${identity.name}: ${String(identity.version)}`);
  return identity;
}

export function loadPackMetadata(packs) {
  return packs.map((pack) => {
    const metadata = pack.metadataEntrypoint ? loadMetadataFile(pack) : {};
    return toClientMetadata(pack, metadata);
  });
}

function loadMetadataFile(pack) {
  const source = readFileSync(pack.metadataEntrypoint, 'utf8');
  const expression = source.replace(/^\s*export\s+default\s+/, 'return ');
  if (expression === source) throw new Error(`Pack ${pack.name} metadata must use export default`);
  const metadata = Function(`'use strict';\n${expression}`)();
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`Pack ${pack.name} metadata must export an object`);
  }
  return metadata;
}

function toClientMetadata(pack, metadata) {
  const title = typeof metadata.title === 'string' && metadata.title.length > 0 ? metadata.title : pack.name;
  const route = `/p/${pack.name}`;
  const nav = metadata.nav && typeof metadata.nav === 'object'
    ? {
        label: typeof metadata.nav.label === 'string' && metadata.nav.label.length > 0 ? metadata.nav.label : title,
        href: metadata.nav.href === route ? metadata.nav.href : route,
      }
    : null;
  return {
    name: pack.name,
    version: pack.version,
    title,
    nav,
    routes: pack.pages.map((page) => ({ pattern: `/p/${page.pack}`, page: page.page })),
  };
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

    seenPacks.add(pack);
    seenPaths.add(pattern);
    return { pack, page, pattern, entrypoint };
  });
}
