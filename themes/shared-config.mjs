// Shared Astro configuration for all themes (bare, default, minimal).
//
// Keeping the common config in a single module means a change (e.g. a new
// cache rule, Vite option or server setting) only has to be made once instead
// of being duplicated across every theme directory.

import { defineConfig, memoryCache } from 'astro/config';
import { readFileSync } from 'node:fs';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import packs from '../app/integrations/packs/index.mjs';
import themes from '../app/integrations/themes/index.mjs';

/**
 * Resolve the theme name, preferring the `VANBLOG_THEME_NAME` environment
 * variable and falling back to the `name` field of the theme's theme.json.
 *
 * Fails fast with a clear message instead of crashing with an unhelpful stack
 * trace or silently producing `/themes/undefined/` asset paths.
 *
 * @param {URL} themeJsonUrl - URL of the calling theme's theme.json
 * @returns {string}
 */
export function resolveThemeName(themeJsonUrl) {
  const configured = process.env.VANBLOG_THEME_NAME;
  if (configured) return configured;

  try {
    const themeJson = JSON.parse(readFileSync(themeJsonUrl, 'utf8'));
    if (!themeJson || typeof themeJson.name !== 'string' || !themeJson.name) {
      throw new Error('theme.json missing "name" field');
    }
    return themeJson.name;
  } catch (err) {
    console.error(`Failed to read theme name from ${themeJsonUrl.pathname}:`, err.message);
    process.exit(1);
  }
}

/**
 * Base Astro config shared by every theme. Theme-specific pieces (source
 * directories, builtin pack page layout) are passed in as parameters.
 */
export function sharedAstroConfig({ themeName, themeSrcDir, mainAppSrcDir, builtinPackPage }) {
  return defineConfig({
    output: 'server',
    base: `/themes/${themeName}/`,
    build: {
      assetsPrefix: `/themes/${themeName}/`,
    },
    adapter: node({ mode: 'standalone' }),
    // Note: experimental.cache is not yet a stable Astro API, and each theme
    // runs as its own SSR instance so the in-memory cache is not shared across
    // themes. For production, consider a reverse-proxy cache (e.g. Nginx,
    // Caddy) or CDN rules instead.
    experimental: {
      cache: {
        provider: memoryCache(),
      },
      routeRules: {
        '/posts/[id]': { maxAge: 300, swr: 60, tags: ['posts'] },
        '/': { maxAge: 300, swr: 60, tags: ['posts', 'home'] },
        '/archive': { maxAge: 600, swr: 120, tags: ['posts'] },
      },
    },
    server: {
      host: process.env.THEME_HOST || '127.0.0.1',
      port: Number(process.env.THEME_PORT) || 4321,
    },
    vite: {
      plugins: [tailwindcss()],
      ssr: {
        noExternal: ['@vanblog/sdk'],
      },
      worker: {
        format: 'es',
      },
      optimizeDeps: {
        exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/png', '@jsquash/webp'],
        include: ['mermaid'],
      },
      build: {
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules/bytemd') ||
                  id.includes('node_modules/@bytemd') ||
                  id.includes('node_modules/katex') ||
                  id.includes('node_modules/markdown-it')) {
                return 'editor-vendor';
              }
            },
          },
        },
      },
    },
    integrations: [
      mdx(),
      themes({ themeSrcDir, mainAppSrcDir }),
      packs({ themePage: builtinPackPage }),
    ],
  });
}
