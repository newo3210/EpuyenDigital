import { defineProject } from 'vitest/config';

// Shared package test project - pure logic in a Node environment.
export default defineProject({
  test: {
    name: 'shared',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
