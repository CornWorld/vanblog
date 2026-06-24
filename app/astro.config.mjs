import { defineConfig } from 'astro/config';

// Vanblog frontend configuration
// prod: SSG (static output, served by Caddy)
// dev: SSR dev server on port 4321 (proxied by Caddy)
export default defineConfig({
  output: 'static',
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
});
