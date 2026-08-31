import { expect, type Page } from '@playwright/test'

export async function enterHomepageArchive(page: Page) {
  const enterArchive = page.locator('[data-signal-loader-enter]')

  if ((await enterArchive.count()) === 0) return

  await expect(enterArchive).toBeVisible()
  await enterArchive.click()
  await expect(enterArchive).toHaveCount(0)
  await expect(page.locator('[data-gallery-main]')).toBeFocused()
}
