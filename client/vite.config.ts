import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cs/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
