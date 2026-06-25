import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';

// Astro cache provider toggle
// Astro 6.0+ will export memoryCache from 'astro/config'.
// When upgrading to Astro 6, uncomment the cache config below.
//
// import { memoryCache } from 'astro/config';

const enableAstroCache = false; // TODO: set to true after upgrading to Astro 6.0+

export default defineConfig({
  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
  // cache: enableAstroCache ? {
  //   provider: memoryCache(),
  // } : undefined,
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    ssr: {
      noExternal: ['@vanblog/sdk'],
    },
  },
  integrations: [mdx()],
});
