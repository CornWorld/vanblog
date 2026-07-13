import { fileURLToPath } from 'node:url';
import { resolvePublicPages } from './resolver.mjs';

const appDirectory = new URL('../../', import.meta.url);
const repositoryDirectory = new URL('../../../', import.meta.url);
const themePage = fileURLToPath(new URL('src/layouts/PackPage.astro', appDirectory));
const bookmarksPage = fileURLToPath(new URL('packs/bookmarks/pages/index.astro', repositoryDirectory));
const virtualId = 'vanblog:theme';
const resolvedVirtualId = `\0${virtualId}`;

function themePlugin() {
  return {
    name: 'vanblog-pack-theme',
    resolveId(id) {
      return id === virtualId ? resolvedVirtualId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualId) return undefined;
      this.addWatchFile(themePage);
      return `export { default as Page } from ${JSON.stringify(themePage)};`;
    },
  };
}

export default function packsIntegration() {
  return {
    name: 'vanblog-packs',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const pages = resolvePublicPages([
          { pack: 'bookmarks', page: 'index', entrypoint: bookmarksPage },
        ]);
        for (const page of pages) {
          injectRoute({ pattern: page.pattern, entrypoint: page.entrypoint });
        }
        updateConfig({ vite: { plugins: [themePlugin()] } });
      },
      'astro:server:setup': ({ server }) => {
        server.watcher.add([themePage, bookmarksPage]);
      },
    },
  };
}
