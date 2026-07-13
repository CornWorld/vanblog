import { defineConfig, memoryCache } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import packs from './integrations/packs/index.mjs';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
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
      // The two chunks that cross 1MB are both already correctly isolated:
      //   - flowchart-elk-definition (~1.4MB): only fetched when a post
      //     contains a ```flowchart block; mermaid lazy-loads each diagram
      //     renderer on demand.
      //   - editor-vendor (~1.1MB): bytemd + katex + markdown-it, loaded
      //     only on /admin/edit. Splitting further would just add round-trips
      //     on first paint of the editor without shrinking total bytes.
      // Bump the limit so the build stops warning about chunks that are
      // already on the right side of a route-level code split.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Group bytemd + plugins + katex + markdown-it into one
            // editor-vendor chunk. Mermaid + flowchart-elk + cytoscape +
            // the dozen diagram renderers are left to rollup's default
            // splitting — each diagram renderer already lands on its own
            // lazy chunk, which is what we want (a 1.4MB flowchart-elk chunk
            // only loads when a post actually contains a flowchart).
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
  integrations: [mdx(), packs()],
});
