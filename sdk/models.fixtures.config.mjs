import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".tmp/models-fixtures",
    emptyOutDir: true,
    lib: {
      entry: "src/models/models.fixtures.ts",
      formats: ["cjs"],
      fileName: () => "models.fixtures.cjs",
    },
    rollupOptions: {
      external: [],
    },
    minify: false,
    target: "node18",
  },
});
