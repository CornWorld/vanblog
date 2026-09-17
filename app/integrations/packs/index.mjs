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
const packsVirtualId = 'virtual:vanblog/packs';
const resolvedPacksVirtualId = `\0${packsVirtualId}`;
const frontendVirtualId = 'virtual:vanblog/pack-frontend';
const resolvedFrontendVirtualId = `\0${frontendVirtualId}`;

function packVirtualPlugin(metadata, packs, themePage) {
  const frontend = packs.flatMap((pack) => {
    const contribution = metadata.find((item) => item.name === pack.name)?.frontend;
    if (!contribution) return [];
    return [{
      name: pack.name,
      scope: contribution.scope,
      styles: contribution.styles.map((path) => `${pack.directory}/frontend/${path}?url`),
      scripts: contribution.scripts.map((path) => `${pack.directory}/frontend/${path}?url`),
    }];
  });
  return {
    name: 'vanblog-pack-virtual-modules',
    resolveId(id) {
      if (id === themeVirtualId) return resolvedThemeVirtualId;
      if (id === packsVirtualId) return resolvedPacksVirtualId;
      if (id === frontendVirtualId) return resolvedFrontendVirtualId;
      return undefined;
    },
    load(id) {
      if (id === resolvedThemeVirtualId) {
        this.addWatchFile(themePage);
        return `export { default as Page } from ${JSON.stringify(themePage)};`;
      }
      if (id === resolvedPacksVirtualId) {
        return `export const packs = ${JSON.stringify(metadata)};\nexport default packs;`;
      }
      if (id === resolvedFrontendVirtualId) {
        // Watch the individual frontend contribution files so Vite invalidates
        // the virtual `frontend` module when a specific style/script changes
        // during development (seamless HMR without a manual refresh).
        for (const item of frontend) {
          for (const style of item.styles) this.addWatchFile(style.split('?')[0]);
          for (const script of item.scripts) this.addWatchFile(script.split('?')[0]);
        }
        const imports = frontend.flatMap((item, packIndex) => [
          ...item.styles.map((path, index) => `import style_${packIndex}_${index} from ${JSON.stringify(path)};`),
          ...item.scripts.map((path, index) => `import script_${packIndex}_${index} from ${JSON.stringify(path)};`),
        ]).join('\n');
        const lines = frontend.map((item, packIndex) => {
          const styles = item.styles.map((_, index) => `style_${packIndex}_${index}`).join(',');
          const scripts = item.scripts.map((_, index) => `script_${packIndex}_${index}`).join(',');
          return `{ name: ${JSON.stringify(item.name)}, scope: ${JSON.stringify(item.scope)}, styles: [${styles}], scripts: [${scripts}] }`;
        }).join(',');
        return `${imports}\nexport const contributions = [${lines}];\nexport default contributions;`;
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
        const pages = resolvePublicPages(packs.flatMap((pack) => pack.pages));
        const metadata = loadPackMetadata(packs);
        for (const page of pages) injectRoute({ pattern: page.pattern, entrypoint: page.entrypoint });
        updateConfig({ vite: { plugins: [packVirtualPlugin(metadata, packs, themePage)] } });
      },
      'astro:server:setup': ({ server }) => {
        let packs;
        try {
          packs = resolvePacks();
        } catch (err) {
          throw new Error(`Failed to resolve packs: ${err.message}`);
        }
        const metadata = loadPackMetadata(packs);
        server.watcher.add([
          themePage,
          ...packs.flatMap((pack) => [
            pack.directory,
            ...pack.pages.map((page) => page.entrypoint),
          ]),
        ]);
        // Dev 静态服务:/pack-static/<pack>/<dir>/* → frontend/<dir>/*(生产由
        // astro:build:done 原样拷贝,见下)。第三方 widget 按相对路径加载
        // 兄弟文件,哈希化的 _astro 资产管线无法满足,只能原样服务。
        const staticDirs = collectStaticDirs(metadata, packs);
        if (staticDirs.length > 0) {
          server.middlewares.use((req, res, next) => {
            const url = (req.url || '').split('?')[0];
            const match = /^\/pack-static\/([\w-]+)\/([\w-]+)\/(.+)$/.exec(decodeURIComponent(url));
            if (!match) return next();
            const entry = staticDirs.find((item) => item.pack === match[1] && item.dir === match[2]);
            if (!entry) return next();
            const file = join(entry.root, match[3]);
            if (!file.startsWith(entry.root) || !existsSync(file) || !statSync(file).isFile()) return next();
            res.setHeader('Content-Type', CONTENT_TYPES[file.split('.').pop()] || 'application/octet-stream');
            res.end(readFileSync(file));
          });
        }
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
