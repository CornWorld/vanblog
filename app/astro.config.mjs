import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
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
