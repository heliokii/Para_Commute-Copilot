import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so the PWA plugin stays out of test runs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
