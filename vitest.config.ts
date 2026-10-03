import { fileURLToPath, URL } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    include: ['**/*.test.{ts,tsx}'],
    // Local backups, nested worktrees, and linked skills are not test roots.
    exclude: [
      ...configDefaults.exclude,
      '.claude/**',
      '.agents/**',
      'work/**',
      'tests/e2e/**',
      'docs/skills/**'
    ],
    maxWorkers: '50%'
  }
})
