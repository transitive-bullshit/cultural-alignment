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
    // Nested Claude worktrees and the symlinked skill directory would
    // otherwise rerun other branches' tests and the opt-in meme evals.
    exclude: [
      ...configDefaults.exclude,
      '.claude/**',
      '.agents/**',
      'tests/e2e/**',
      'docs/skills/**'
    ],
    maxWorkers: '50%'
  }
})
