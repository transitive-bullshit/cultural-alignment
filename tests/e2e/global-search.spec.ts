import { expect, test } from '@playwright/test'

import searchDocuments from '../../content/snapshot/search-documents.json' with { type: 'json' }
import type { SearchDocument } from '../../lib/content/catalog'

const documents = searchDocuments as readonly SearchDocument[]
const searchTarget = documents.find((document) => document.kind === 'concept')!
const longestTitleTarget = documents.reduce((longest, document) =>
  document.title.length > longest.title.length ? document : longest
)

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 }
]) {
  test.describe(`touch search at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true })

    test('keeps text readable through focus, dismissal, and navigation', async ({
      page
    }) => {
      await page.goto('/about')
      const trigger = page.getByRole('button', { name: /Search site/ })
      const input = page.getByRole('combobox')
      const dialog = page.getByRole('dialog')

      await trigger.tap()
      await expect(input).toBeFocused()
      // iOS focus zoom is native behavior that emulation cannot reproduce.
      // Check its font-size threshold rather than asserting Chromium's scale.
      expect(
        await input.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )
      ).toBeGreaterThanOrEqual(16)
      const viewportMeta = await page
        .locator('meta[name="viewport"]')
        .getAttribute('content')
      expect(viewportMeta).not.toMatch(
        /maximum-scale|user-scalable\s*=\s*(no|0)/
      )

      await input.fill(longestTitleTarget.title)
      const result = page.locator(
        `[data-search-result-href="${longestTitleTarget.href}"]`
      )
      const title = result.locator('[data-search-result-title]')
      await expect(title).toHaveText(longestTitleTarget.title)
      await page.evaluate(() => document.fonts.ready)
      const bounds = await title.evaluate((element) => ({
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        height: element.clientHeight,
        contentHeight: element.scrollHeight
      }))
      expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1)
      expect(bounds.contentHeight).toBeLessThanOrEqual(bounds.height + 1)
      const dialogBounds = await dialog.boundingBox()
      expect(dialogBounds!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(
        viewport.width
      )

      await page.getByRole('button', { name: 'Clear search' }).tap()
      await expect(input).toHaveValue('')
      await expect(input).toBeFocused()
      // Touch visitors dismiss by tapping the backdrop.
      await page.touchscreen.tap(8, 8)
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()

      await trigger.tap()
      await expect(input).toBeFocused()
      await input.fill(longestTitleTarget.title)
      await result.tap()
      await page.waitForURL((url) => url.pathname === longestTitleTarget.href)
      await expect(dialog).toBeHidden()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        longestTitleTarget.title
      )
    })
  })
}

test('global search shortcut navigates to a concept detail', async ({
  page
}) => {
  await page.goto('/about')

  await page.locator('[data-search-ready="true"]').waitFor()

  const searchIndexResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/content/search-index.json',
    { timeout: 15_000 }
  )

  await page.keyboard.press('ControlOrMeta+k')

  const input = page.getByRole('combobox')
  expect((await searchIndexResponse).ok()).toBe(true)
  await input.fill(searchTarget.title)

  const result = page.locator(
    `[data-search-result-href="${searchTarget.href}"]`
  )

  const navigation = page.waitForURL(
    (url) => url.pathname === searchTarget.href,
    { timeout: 15_000, waitUntil: 'commit' }
  )

  await result.click()
  await navigation
  await expect(page.locator('[data-resource-detail="concept"]')).toBeVisible()
})
