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
        server.watcher.add([
          themePage,
          ...packs.flatMap((pack) => [
            pack.directory,
            ...pack.pages.map((page) => page.entrypoint),
          ]),
        ]);
      },
    },
  };
}
