import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      veriskit: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "test/**/*.test.ts",
      "mcp/*.test.ts",
      "mcp/src/**/*.test.ts",
    ],
  },
});
