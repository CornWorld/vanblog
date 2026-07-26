import { defineConfig, memoryCache } from 'astro/config';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import packs from '../../app/integrations/packs/index.mjs';
import themes from '../../app/integrations/themes/index.mjs';

const themeSrcDir = fileURLToPath(new URL('./src', import.meta.url));
const mainAppSrcDir = fileURLToPath(new URL('../../app/src/', import.meta.url));
const builtinPackPage = fileURLToPath(new URL('./src/layouts/PackPage.astro', import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
    routeRules: {
      '/posts/[id]': { maxAge: 300, swr: 60, tags: ['posts'] },
      '/': { maxAge: 300, swr: 60, tags: ['posts', 'home'] },
      '/archive': { maxAge: 600, swr: 120, tags: ['posts'] },
      '/api/feed.xml': { maxAge: 1800, tags: ['posts', 'feed'] },
      '/api/atom.xml': { maxAge: 1800, tags: ['posts', 'feed'] },
      '/api/sitemap.xml': { maxAge: 3600, tags: ['posts', 'feed'] },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
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
