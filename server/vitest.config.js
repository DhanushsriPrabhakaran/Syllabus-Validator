import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // Run test suites sequentially to avoid shared MongoDB collection races
    include: ['tests/**/*.test.js']
  }
});
