import { defineConfig } from 'vitest/config';

// Explicit opt-in, never silently skipped: requires the real local development artifacts.
export default defineConfig({
  test: {
    environment: 'node', include: ['test/**/*.integration.ts'],
    fileParallelism: false, testTimeout: 120_000,
  },
});
