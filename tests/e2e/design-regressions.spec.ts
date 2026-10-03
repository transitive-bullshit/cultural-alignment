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

test('phone galleries keep their header and archive controls clear', async ({
  page
}) => {
  const viewport = { width: 390, height: 844 }
  await page.setViewportSize(viewport)

  for (const route of ['/', '/scenarios']) {
    await page.goto(route)
    const header = page.locator('[data-site-header]')
    const canvas = page.locator('[data-spatial-gallery] canvas')
    await expect(canvas).toBeVisible()
    // A lost shell override makes the header participate in normal flow.
    await expect(header).toHaveCSS('position', 'fixed')

    if (route === '/scenarios') {
      const toolbar = page.getByRole('navigation', {
        name: 'Scenario gallery controls',
        includeHidden: true
      })
      const touchHint = page.getByText('Tap once to select · again to open', {
        exact: true
      })
      await expect(toolbar).toBeVisible()
      await expect(touchHint).toBeVisible()
      // The archive reserves room for its toolbar and touch guidance.
      await expect
        .poll(async () => {
          const [toolbarBox, canvasBox, hintBox] = await Promise.all([
            toolbar.boundingBox(),
            canvas.boundingBox(),
            touchHint.boundingBox()
          ])
          if (!toolbarBox || !canvasBox || !hintBox) return null
          return {
            gap: canvasBox.y - (toolbarBox.y + toolbarBox.height),
            hintClear: canvasBox.y + canvasBox.height <= hintBox.y
          }
        })
        .toEqual({ gap: 0, hintClear: true })
      continue
    }

    // Development and production order module CSS differently, so a lost
    // shell override shows up here as a band between header and canvas.
    await expect
      .poll(async () => {
        const [headerBox, canvasBox] = await Promise.all([
          header.boundingBox(),
          canvas.boundingBox()
        ])
        if (!headerBox || !canvasBox) return null
        return {
          gap: canvasBox.y - (headerBox.y + headerBox.height),
          bottom: canvasBox.y + canvasBox.height
        }
      })
      .toEqual({ gap: 0, bottom: viewport.height })
  }
})
