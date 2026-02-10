/// <reference types="vitest" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isTest = !!process.env.VITEST;

export default defineConfig({
  // Exclude @tailwindcss/vite during tests — vitest 4.x bundles Vite 7.x
  // internally, which is incompatible with @tailwindcss/vite 4.x (designed
  // for Vite 5.x). Tests don't need real Tailwind CSS processing.
  plugins: [...(isTest ? [] : [tailwindcss()]), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    host: true,
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.tsx"],
    css: false,
  },
});
