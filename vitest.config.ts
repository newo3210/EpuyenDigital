import { defineConfig } from 'vitest/config';

// Workspace test runner - web (foundation + webhook), shared, and pet worker.
export default defineConfig({
  test: {
    projects: ['apps/web', 'packages/shared', 'worker'],
  },
});
