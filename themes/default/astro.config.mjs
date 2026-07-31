import { fileURLToPath } from 'node:url';
import { resolveThemeName, sharedAstroConfig } from '../shared-config.mjs';

const themeSrcDir = fileURLToPath(new URL('./src', import.meta.url));
const mainAppSrcDir = fileURLToPath(new URL('../../app/src/', import.meta.url));
const builtinPackPage = fileURLToPath(new URL('./src/layouts/PackPage.astro', import.meta.url));

const themeName = resolveThemeName(new URL('./theme.json', import.meta.url));

export default sharedAstroConfig({ themeName, themeSrcDir, mainAppSrcDir, builtinPackPage });
