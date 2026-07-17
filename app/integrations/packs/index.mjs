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
const frontendVirtualId = 'virtual:vanblog/pack-frontend';
const resolvedFrontendVirtualId = `\0${frontendVirtualId}`;

function packVirtualPlugin(metadata, packs) {
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

export default function packsIntegration() {
  return {
    name: 'vanblog-packs',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const packs = discoverPacks(packsDirectory);
        const pages = resolvePublicPages(packs.flatMap((pack) => pack.pages));
        const metadata = loadPackMetadata(packs);
        for (const page of pages) injectRoute({ pattern: page.pattern, entrypoint: page.entrypoint });
        updateConfig({ vite: { plugins: [packVirtualPlugin(metadata, packs)] } });
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
