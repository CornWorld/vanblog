import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { zodDecouplingAlias } from '@zod-codepen/vite-plugin';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'type/index': resolve(__dirname, 'src/type/index.ts'),
        'runtime/index': resolve(__dirname, 'src/runtime/index.ts'),
        'contracts/index': resolve(__dirname, 'src/contracts/index.ts'),
        'drizzle/index': resolve(__dirname, 'src/drizzle/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => {
        return id === '@ts-rest/core' || id.startsWith('@ts-rest/');
      },
      output: {
        entryFileNames: '[name].js',
        // Better chunk naming based on content
        chunkFileNames: (chunkInfo) => {
          // Use moduleIds (always populated) instead of modules
          const moduleIds = chunkInfo.moduleIds || [];

          // Check what the chunk contains (order matters for priority)
          const hasDrizzle = moduleIds.some(
            (m) => m.includes('node_modules/drizzle-orm') || m.includes('node_modules/drizzle-zod'),
          );
          const hasZod = moduleIds.some((m) => m.includes('node_modules/zod'));
          const hasDayjs = moduleIds.some((m) => m.includes('node_modules/dayjs'));

          // Check for project source files
          const hasContract = moduleIds.some(
            (m) => m.includes('/src/contract.ts') || m.includes('/src/schemas.ts'),
          );
          const hasDayjsUtils = moduleIds.some((m) => m.includes('/src/dayjs.ts'));

          // Name based on primary content (most specific first)
          if (hasDrizzle) {
            return 'chunks/drizzle-[hash].js';
          }
          // Contract + schemas bundle (includes timeline-schemas, date-codecs, etc.)
          if (hasContract) {
            return 'chunks/contract-schemas-[hash].js';
          }
          if (hasZod && hasDayjs) {
            return 'chunks/zod-dayjs-[hash].js';
          }
          if (hasZod) {
            return 'chunks/zod-[hash].js';
          }
          if (hasDayjsUtils || hasDayjs) {
            return 'chunks/dayjs-[hash].js';
          }
          return 'chunks/[name]-[hash].js';
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  plugins: [
    // Redirect schema imports to pure Zod version (no drizzle dependency)
    zodDecouplingAlias({
      aliasFrom: '../runtime/schema.js',
      aliasTo: './src/generated/api-schemas.ts',
    }),
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
    }),
  ],
});
