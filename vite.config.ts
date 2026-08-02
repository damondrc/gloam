// Imported from vitest rather than vite so the `test` block below is typed.
// It is the same defineConfig otherwise.
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Tauri expects a fixed port and must not obscure Vite errors.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
  test: {
    // The suite covers pure logic only, so it needs no DOM — which keeps a
    // full run under a second and gives the tests no reason to be flaky.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
