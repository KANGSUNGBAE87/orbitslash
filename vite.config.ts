import { defineConfig } from "vite";

// Orbit Slash — Vite 설정. Apps in Toss WebView 타깃, base 상대경로.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
  server: {
    host: true,
    port: 5173,
  },
});
