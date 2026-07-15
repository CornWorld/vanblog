import { fileURLToPath } from 'node:url';
import { discoverPacks, loadPackMetadata, resolvePublicPages } from './resolver.mjs';

const appDirectory = new URL('../../', import.meta.url);
const repositoryDirectory = new URL('../../../', import.meta.url);
const themePage = fileURLToPath(new URL('src/layouts/PackPage.astro', appDirectory));
const packsDirectory = fileURLToPath(new URL('packs', repositoryDirectory));
const themeVirtualId = 'vanblog:theme';
const resolvedThemeVirtualId = `\0${themeVirtualId}`;
const packsVirtualId = 'virtual:vanblog/packs';
const resolvedPacksVirtualId = `\0${packsVirtualId}`;

function packVirtualPlugin(metadata) {
  return {
    name: 'vanblog-pack-virtual-modules',
    resolveId(id) {
      if (id === themeVirtualId) return resolvedThemeVirtualId;
      if (id === packsVirtualId) return resolvedPacksVirtualId;
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
      return undefined;
    },
  };
}

export default function packsIntegration() {
  return {
    name: 'vanblog-packs',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const packs = discoverPacks(packsDirectory);
        const pages = resolvePublicPages(packs.flatMap((pack) => pack.pages));
        const metadata = loadPackMetadata(packs);
        for (const page of pages) {
          injectRoute({ pattern: page.pattern, entrypoint: page.entrypoint });
        }
        updateConfig({ vite: { plugins: [packVirtualPlugin(metadata)] } });
      },
      'astro:server:setup': ({ server }) => {
        const packs = discoverPacks(packsDirectory);
        server.watcher.add([
          themePage,
          ...packs.flatMap((pack) => [
            pack.directory,
            ...pack.pages.map((page) => page.entrypoint),
            ...(pack.metadataEntrypoint ? [pack.metadataEntrypoint] : []),
          ]),
        ]);
      },
    },
  };
}
