import { defineWorkspace } from "vitest/config";

// Workspace - Vitest projects for shared, web, and worker packages
export default defineWorkspace([
  "packages/shared/vitest.config.ts",
  "apps/web/vitest.config.ts",
  "worker/vitest.config.ts",
]);
