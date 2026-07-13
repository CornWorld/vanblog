import { defineConfig } from 'vite'

// Bundle the schemas and Zod into the single CJS artifact embedded by Go.
export default defineConfig({
  build: {
    outDir: 'vault/internal/validation',
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
    // This target is covered by the Goja compilation/runtime tests.
    target: 'es2020',
  },
})
