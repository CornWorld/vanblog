import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

export function isDynamicModulePayload(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (!('module' in obj)) return false;
  const mod = (obj as { module?: unknown }).module;
  const modType = typeof mod;
  if (modType !== 'function' && modType !== 'object') return false;
  if (
    'imports' in obj ||
    'controllers' in obj ||
    'providers' in obj ||
    'exports' in obj ||
    'global' in obj
  ) {
    return true;
  }
  const keys = Object.keys(obj);
  const [only] = keys;
  return keys.length === 1 && only === 'module';
}

export async function tryImportObjectPlugin(
  absPath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const url = pathToFileURL(absPath).href;
    const mod: unknown = await import(/* @vite-ignore */ url);
    const def = (mod as Record<string, unknown>).default;
    const exp: unknown = def ?? mod;
    if (isDynamicModulePayload(exp)) return null;
    if (typeof exp === 'object' && exp !== null) return exp as Record<string, unknown>;
    return null;
  } catch {
    /* noop: optional import failure */
    return null;
  }
}

export async function resolveObjectPluginExport(
  pluginDir: string,
): Promise<Record<string, unknown> | null> {
  // 1) plugin.json main
  try {
    const mfPath = join(pluginDir, 'plugin.json');
    const mfContent = await readFile(mfPath, 'utf-8');
    const mf = JSON.parse(mfContent) as { main?: string };
    if (mf.main) {
      const p = join(pluginDir, mf.main);
      const r = await tryImportObjectPlugin(p);
      if (r) return r;
    }
  } catch {
    /* noop: optional plugin.json */
  }

  // 2) package.json main
  try {
    const pkgPath = join(pluginDir, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent) as {
      main?: string;
      name?: string;
      version?: string;
      description?: string;
    };
    if (pkg.main) {
      const p = join(pluginDir, pkg.main);
      const r = await tryImportObjectPlugin(p);
      if (r) return r;
    }
  } catch {
    /* noop: optional package.json */
  }

  // 3) index.* fallback
  const idx = ['index.ts', 'index.js', 'index.mjs'];
  for (const f of idx) {
    try {
      const p = join(pluginDir, f);
      await stat(p);
      const r = await tryImportObjectPlugin(p);
      if (r) return r;
    } catch {
      /* noop: index not exists */
    }
  }
  return null;
}
