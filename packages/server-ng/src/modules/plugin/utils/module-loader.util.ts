import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

import type { DynamicModule, Logger } from '@nestjs/common';

function isLikelyDynamicModule(mod: unknown): mod is DynamicModule {
  if (mod == null || typeof mod !== 'object') return false;
  const o = mod as Record<string, unknown>;
  return 'module' in o;
}

export async function hasNestModule(dir: string): Promise<boolean> {
  const candidates = [
    'module.ts',
    'plugin.module.ts',
    'index.ts',
    'module.js',
    'plugin.module.js',
    'index.js',
  ];
  for (const f of candidates) {
    try {
      const p = join(dir, f);
      await stat(p);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

export async function loadNestDynamicModules(
  pluginsDir: string,
  logger?: Logger,
): Promise<DynamicModule[]> {
  const res: DynamicModule[] = [];
  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const dir = join(pluginsDir, entry.name);

      const candidates = [
        'module.ts',
        'plugin.module.ts',
        'index.ts',
        'module.js',
        'plugin.module.js',
        'index.js',
      ];

      let found: string | undefined;
      for (const f of candidates) {
        try {
          const p = join(dir, f);
          await stat(p);
          found = p;
          break;
        } catch {
          // continue
        }
      }
      if (!found) continue;

      try {
        const url = pathToFileURL(found).href;
        // @vite-ignore for ESM bundlers
        const modNs: unknown = await import(/* @vite-ignore */ url);
        const ns = modNs as Record<string, unknown>;
        // 按优先级选择导出
        const firstValue = (() => {
          const values = Object.values(ns);
          return values.length > 0 ? values[0] : undefined;
        })();
        const maybe = ns.PluginModule ?? ns.default ?? firstValue;
        if (isLikelyDynamicModule(maybe)) {
          res.push(maybe);
          if (logger) {
            if (typeof logger.log === 'function') {
              logger.log(`Discovered Nest DynamicModule from ${entry.name}`);
            }
          }
        }
      } catch (e) {
        if (logger && typeof logger.warn === 'function') {
          const msg = e instanceof Error ? e.message : String(e);
          logger.warn(`Failed to import plugin module from ${entry.name}: ${msg}`);
        }
      }
    }
  } catch {
    // ignore if plugins directory not found
  }
  return res;
}
