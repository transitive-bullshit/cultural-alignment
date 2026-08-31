import type { Page } from '@playwright/test'

export async function enterHomepageArchive(page: Page) {
  const enterArchive = page.locator('[data-signal-loader-enter]')

  if ((await enterArchive.count()) === 0) return

  await enterArchive.click()
}
