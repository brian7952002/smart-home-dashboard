import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("./shared", import.meta.url)) },
  },
  test: {
    include: ["tests/api/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/api/globalSetup.ts"],
    // All API test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
