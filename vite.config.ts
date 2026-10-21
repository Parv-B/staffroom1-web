/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The browser talks to the API through this dev server (same origin, so the user only needs
// to forward port 5173) and to S3 directly at the presigned URL's host (127.0.0.1:8333).
const API_TARGET = process.env.STAFFROOM_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true, quoteStyle: "double" }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: { sourcemap: false },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
    css: false,
  },
});
