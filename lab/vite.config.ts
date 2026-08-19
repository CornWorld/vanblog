import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Lab: agent experiment report UI.
// Dev: Vite serves the frontend and proxies /api to the artifacts-server.
// The artifacts-server is started alongside via the `dev` script.
const API_PORT = 9751;

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 9750,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
