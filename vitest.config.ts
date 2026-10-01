import { defineConfig } from 'vitest/config';

// Workspace test runner - one Vitest project per package.
export default defineConfig({
  test: {
    projects: ['apps/web', 'packages/shared'],
  },
});
