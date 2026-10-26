import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/release/**"]
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:47821",
        changeOrigin: true
      }
    }
  }
});
