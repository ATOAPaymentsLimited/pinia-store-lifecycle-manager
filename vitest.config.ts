import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test-d.ts'],
    },
    reporters: process.env.GITHUB_ACTIONS ? ['verbose', 'github-actions'] : ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})
