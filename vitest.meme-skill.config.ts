import { configDefaults, defineConfig } from 'vitest/config'

import config from './vitest.config'

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['docs/skills/ai-safety-meme-creator/evals/**/*.test.ts'],
    exclude: configDefaults.exclude,
    // Raster tests exceed the 5 s default under parallel load.
    testTimeout: 30_000
  }
})
