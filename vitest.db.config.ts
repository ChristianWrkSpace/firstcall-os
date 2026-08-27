import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/integration/**/*.db.test.ts"],
    environment: "node",
    globals: false,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
