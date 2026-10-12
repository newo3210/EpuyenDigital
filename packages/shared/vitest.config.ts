import { defineConfig } from "vitest/config";

// Vitest config - shared package unit tests
export default defineConfig({
  test: {
    name: "shared",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
