import { configDefaults, defineConfig } from 'vitest/config'

import config from './vitest.config'

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['docs/skills/ai-safety-meme-creator/evals/**/*.test.ts'],
    exclude: configDefaults.exclude
  }
})
