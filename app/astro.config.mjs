import { defineConfig, memoryCache } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';

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
    ssr: {
      noExternal: ['@vanblog/sdk'],
    },
    // @jsquash/avif ships a multi-threaded worker module (avif_enc_mt.js)
    // that uses ESM imports internally. Vite's default worker.format='iife'
    // can't represent static imports → build fails with
    // "Invalid value 'iife' for option 'worker.format'". Forcing 'es'
    // resolves it. See https://github.com/jamsinclair/jSquash/issues/37.
    worker: {
      format: 'es',
    },
    // Same root cause: keep jSquash packages out of Vite's pre-bundler so
    // their internal worker wiring survives intact.
    optimizeDeps: {
      exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/png', '@jsquash/webp'],
    },
  },
  integrations: [mdx()],
});
