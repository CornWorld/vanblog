import { defineConfig } from 'vite'

// Build the core schemas and Zod into an explicit CJS runtime artifact consumed by Go.
export default defineConfig({
  build: {
    outDir: 'runtime/core-schema',
    emptyOutDir: false,
    lib: {
      entry: 'sdk/src/models/index.ts',
      formats: ['cjs'],
      fileName: () => 'models.js',
    },
    rollupOptions: {
      external: [],
    },
    minify: false,
    sourcemap: false,
    // This target is covered by the Goja compilation/runtime tests.
    target: 'es2020',
  },
})
