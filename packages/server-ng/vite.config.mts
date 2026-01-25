import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import swc from 'unplugin-swc';

export default defineConfig({
  server: {
    port: 3050,
  },
  plugins: [
    ...VitePluginNode({ adapter: 'nest', appPath: './src/main.ts', exportName: 'viteNodeApp' }),
    swc.vite({ module: { type: 'es6' } }),
  ],
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist',
    sourcemap: true,
    minify: false,
  },
});
