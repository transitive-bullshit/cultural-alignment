import { expect, test } from '@playwright/test'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import franchises from '../../content/snapshot/franchises.json' with { type: 'json' }
import families from '../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

import { mockOptimizedImages } from './image-fixtures'

const routes = [
  `/scenarios/${scenarios[0]!.slug}`,
  `/sources/${sources[0]!.slug}`,
  `/franchises/${franchises[0]!.slug}`,
  `/risk-families/${families[0]!.slug}`,
  `/concepts/${concepts[0]!.slug}`
]

for (const width of [1440, 390]) {
  test(`detail links copy the current URL at ${width}px`, async ({
    page,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width, height: 900 })
    await mockOptimizedImages(page)

    for (const route of routes) {
      await page.goto(`${route}?ref=copy-test#detail`)
      const button = page.locator('[data-copy-page-link]')
      await expect(button).toBeVisible()
      await expect(button).toBeInViewport()
      await button.click()
      await expect(button).toHaveAttribute('data-state', 'success')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        page.url()
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(width)
    }
  })
}

test('copy feedback restarts on repeated clicks and recovers from errors', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto(routes[0]!)
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => {
        throw new Error('Permission denied')
      }
    })
  })
  const button = page.locator('[data-copy-page-link]')
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('data-state', 'error')
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => {}
    })
  })
  await page.clock.install()
  await button.click()
  await expect(button).toHaveAttribute('data-state', 'success')
  await page.clock.runFor(2000)
  await button.click()
  await page.clock.runFor(1000)
  await expect(button).toHaveAttribute('data-state', 'success')
  await page.clock.runFor(1600)
  await expect(button).toHaveAttribute('data-state', 'idle')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const hiddenIcon = button.locator('[aria-hidden]').nth(1)
  await expect(hiddenIcon).toHaveCSS('transform', 'none')
})
