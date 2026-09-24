import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'

test.beforeEach(async ({ page }) => {
  await mockOptimizedImages(page)
})

test('resource index titles stay inside their column near the tablet breakpoint', async ({
  page
}) => {
  await page.setViewportSize({ width: 700, height: 800 })

  for (const route of [
    '/sources',
    '/franchises',
    '/concepts',
    '/risk-families'
  ]) {
    await page.goto(route)
    await page.evaluate(() => document.fonts.ready)
    const title = page.getByRole('heading', { level: 1 })

    await expect(title).toBeVisible()
    const bounds = await title.evaluate((element) => ({
      available: element.clientWidth,
      content: element.scrollWidth
    }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.available + 1)
  }
})

test('the shared footer fits a small laptop without horizontal scrolling', async ({
  page
}) => {
  await page.setViewportSize({ width: 920, height: 800 })
  await page.goto('/about')
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded()

  const bounds = await page.evaluate(() => ({
    available: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }))
  expect(bounds.content).toBeLessThanOrEqual(bounds.available)
})

test('search stays above the site header on a short landscape screen', async ({
  page
}) => {
  await page.setViewportSize({ width: 700, height: 360 })
  await page.goto('/concepts')
  await page.getByRole('button', { name: /search/i }).click()
  await page.getByRole('combobox').fill('a')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await expect
    .poll(async () =>
      dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return element.contains(
          document.elementFromPoint(rect.left + 24, rect.top + 8)
        )
      })
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /search/i })).toBeFocused()
})

test('privacy hydrates without replacing its server-rendered content', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Opening a hydrated client control ensures this is more than an SSR check.
  await page.getByRole('button', { name: /search/i }).click()
  await expect(page.getByRole('combobox')).toBeFocused()
  expect(errors).toEqual([])
})
