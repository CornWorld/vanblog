import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

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
      // 只有 @ts-rest/core 作为外部依赖
      // zod, drizzle-orm, drizzle-zod, dayjs 都会被内联
      external: (id) => {
        return id === '@ts-rest/core' || id.startsWith('@ts-rest/');
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
    }),
  ],
});
