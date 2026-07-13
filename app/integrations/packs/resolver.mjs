const PACK_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PUBLIC_PATH_PATTERN = /^\/p\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

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
