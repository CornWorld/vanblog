import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPacks, loadPackMetadata, mergeLocalPacks, resolvePublicPages } from './resolver.mjs';

const appDirectory = new URL('../../', import.meta.url);
const repositoryDirectory = new URL('../../../', import.meta.url);
const platformThemePage = fileURLToPath(new URL('src/layouts/PackPage.astro', appDirectory));
const packsDirectory = fileURLToPath(new URL('packs', repositoryDirectory));
// VANBLOG_PACKS_DIR mirrors the Go-side --packsDir flag so that local Pack
// overrides take effect in Astro at the same time as they do in the Go runtime.
// Without this, whole-Pack replacement would only swap hooks/schema on the Go
// side while Astro kept serving builtin pages — a silent split-brain.
const localPacksDirectory = process.env.VANBLOG_PACKS_DIR || '';

function resolvePacks() {
  return mergeLocalPacks(discoverPacks(packsDirectory), localPacksDirectory);
}
const themeVirtualId = 'vanblog:theme';
const resolvedThemeVirtualId = `\0${themeVirtualId}`;

function packVirtualPlugin(themePage) {
  return {
    name: 'vanblog-pack-virtual-modules',
    resolveId(id) {
      if (id === themeVirtualId) return resolvedThemeVirtualId;
      return undefined;
    },
    load(id) {
      if (id === resolvedThemeVirtualId) {
        this.addWatchFile(themePage);
        return `export { default as Page } from ${JSON.stringify(themePage)};`;
      }
      return undefined;
    },
  };
}

export default function packsIntegration(options = {}) {
  // Themes supply their own PackPage host via the themePage option. When
  // unset (e.g. running inside app/ as the platform build), we fall
  // back to app/src/layouts/PackPage.astro.
  const themePage = options.themePage || platformThemePage;
  return {
    name: 'vanblog-packs',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        let packs;
        try {
          packs = resolvePacks();
        } catch (err) {
          throw new Error(`Failed to resolve packs: ${err.message}`);
        }
        // Pack PAGES stay build-time (they are .astro sources that need
        // compilation); pack styles/scripts/static assets moved to the
        // runtime manifest + live /pack-static serving (Go side), so no
        // frontend emission happens here anymore.
        const pages = resolvePublicPages(packs.flatMap((pack) => pack.pages));
        for (const page of pages) injectRoute({ pattern: page.pattern, entrypoint: page.entrypoint });
        updateConfig({ vite: { plugins: [packVirtualPlugin(themePage)] } });
      },
      'astro:server:setup': ({ server }) => {
        let packs;
        try {
          packs = resolvePacks();
        } catch (err) {
          throw new Error(`Failed to resolve packs: ${err.message}`);
        }
        server.watcher.add([
          themePage,
          ...packs.flatMap((pack) => [
            pack.directory,
            ...pack.pages.map((page) => page.entrypoint),
          ]),
        ]);
        // Dev 静态服务:/pack-static/<pack>/<rest> → 该 pack 的 frontend/<rest>。
        // 与生产同构:生产里 Go(vault/internal/pack/routes.go)从合并后的
        // pack 目录服役同一 URL 空间;这里让裸 `astro dev`(无 Caddy/Go 的
        // 主题作者本机流)也能取到 pack 资产。整个 frontend/ 根都在命名
        // 空间内 —— styles/scripts/static 一视同仁。
        const frontendRootByPack = new Map(packs.map((pack) => [pack.name, join(pack.directory, 'frontend')]));
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          const match = /^\/pack-static\/([\w-]+)\/(.+)$/.exec(decodeURIComponent(url));
          if (!match) return next();
          const root = frontendRootByPack.get(match[1]);
          if (!root) return next();
          const file = join(root, match[2]);
          if (!file.startsWith(root + '/') || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('Content-Type', CONTENT_TYPES[file.split('.').pop()] || 'application/octet-stream');
          res.end(readFileSync(file));
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        let packs, metadata;
        try {
          packs = resolvePacks();
          metadata = loadPackMetadata(packs);
        } catch (err) {
          logger.warn(`pack static copy skipped: ${err.message}`);
          return;
        }
        const staticDirs = collectStaticDirs(metadata, packs);
        if (staticDirs.length === 0) return;
        // dir = 客户端输出目录(URL)。拷到 pack-static/<pack>/<dir> 而非
        // _astro/:后者被 Caddy 标 immutable(前提「内容变→URL 变」),固定
        // 路径的原样目录放进去会在 pack 升级后让老访客最长一年读旧缓存。
        // pack-static 走已有 SSR 代理通道(Astro standalone 以 ETag/Last-
        // Modified 服役非哈希文件,2026-09-15 e2e 已验证)→ 升级即重验。
        const clientRoot = fileURLToPath(dir);
        if (!existsSync(join(clientRoot, '_astro'))) return;
        for (const entry of staticDirs) {
          const target = join(clientRoot, 'pack-static', entry.pack, entry.dir);
          cpSync(entry.root, target, { recursive: true });
          logger.info(`pack static: ${entry.pack}/${entry.dir} → ${target}`);
        }
      },
    },
  };
}

// 收集各 pack 的 frontend.static 目录:[{ pack, dir, root }]
function collectStaticDirs(metadata, packs) {
  const directoryByName = new Map(packs.map((pack) => [pack.name, pack.directory]));
  return metadata.flatMap((item) => {
    const statics = item.frontend?.static;
    if (!Array.isArray(statics) || statics.length === 0) return [];
    const directory = directoryByName.get(item.name);
    if (!directory) return [];
    return statics.map((dir) => ({ pack: item.name, dir, root: join(directory, 'frontend', dir) }));
  });
}

const CONTENT_TYPES = {
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  png: 'image/png',
  svg: 'image/svg+xml',
};
