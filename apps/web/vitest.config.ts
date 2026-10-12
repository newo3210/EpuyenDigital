import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config - web route/unit tests
export default defineConfig({
  test: {
    name: "web",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@epuyen/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
