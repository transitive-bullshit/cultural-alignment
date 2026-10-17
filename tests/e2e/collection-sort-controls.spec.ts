import { expect, test, type Locator } from '@playwright/test'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

import { mockOptimizedImages } from './image-fixtures'

const concept = concepts.find(
  ({ id }) =>
    scenarios.filter(({ conceptIds }) => conceptIds.includes(id)).length > 3
)!
const option = (value: string) => `[data-collection-sort-option="${value}"]`
const selection = '[data-collection-sort-selection]'

test('sort selection stays visible for keyboard, reduced motion, and narrow screens', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 812 })
  await page.goto(`/concepts/${concept.slug}`)
  const controls = page.locator('[data-collection-sort-controls]')
  const first = controls.locator(option('default'))
  const newest = controls.locator(option('newest'))
  await expect(first).toHaveAttribute('data-state', 'on')
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(newest).toBeFocused()
  await page.keyboard.press('Space')
  await expect(newest).toHaveAttribute('data-state', 'on')
  await expect(newest).toHaveCSS(
    'color',
    await newest.evaluate((element) => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--proto-electric)'
      element.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
  )
  await expect(controls.locator(selection)).toHaveCount(1)
  await expect(controls.locator(selection)).toHaveCSS(
    'border-top-style',
    'solid'
  )
  await expect(controls.locator(selection)).toHaveCSS('border-top-width', '1px')
  expect(
    await controls
      .locator(selection)
      .evaluate((element) => getComputedStyle(element).backgroundColor)
  ).not.toBe(
    await controls
      .locator('[data-slot="toggle-group"]')
      .evaluate((element) => getComputedStyle(element).backgroundColor)
  )
  await expectAligned(controls.locator(selection), newest)
  await expect(controls.locator(selection)).toHaveCSS('transform', 'none')
  for (const button of await controls
    .locator('[data-collection-sort-option]')
    .all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320
  )
  await page.reload()
  await expect(newest).toHaveAttribute('data-state', 'on')
  await expectAligned(controls.locator(selection), newest)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expectAligned(controls.locator(selection), newest)
})

test('the shared sort background retargets during travel without snapping', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await page.goto(`/concepts/${concept.slug}`)
  const controls = page.locator('[data-collection-sort-controls]')
  await controls.scrollIntoViewIfNeeded()
  const first = controls.locator(option('default'))
  const oldest = controls.locator(option('oldest'))
  const background = controls.locator(selection)
  await expectAligned(background, first)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000))
  const start = (await first.boundingBox())!
  const end = (await oldest.boundingBox())!
  await oldest.click()
  await expect(oldest).toHaveAttribute('data-state', 'on')
  await page.clock.runFor(64)
  const moving = (await background.boundingBox())!
  expect(moving.x).toBeGreaterThan(start.x + 1)
  expect(moving.x).toBeLessThan(end.x - 1)
  await first.click()
  await expect(first).toHaveAttribute('data-state', 'on')
  await page.clock.runFor(16)
  const redirected = (await background.boundingBox())!
  expect(redirected.x).toBeGreaterThan(start.x + 1)
  expect(Math.abs(redirected.x - moving.x)).toBeLessThan((end.x - start.x) / 3)
  await page.clock.runFor(1_000)
  await expectAligned(background, first)
  await expect(background).toHaveCount(1)
  // Selecting the current option cannot clear the collection's sort.
  await first.click()
  await expect(first).toHaveAttribute('data-state', 'on')
  // Changing the OS preference during travel stops movement immediately.
  await oldest.click()
  await page.clock.runFor(64)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expectAligned(background, oldest)
  await expect(background).toHaveCSS('transform', 'none')
})

async function expectAligned(background: Locator, button: Locator) {
  await expect
    .poll(async () => {
      const a = await background.boundingBox()
      const b = await button.boundingBox()
      if (!a || !b) return Number.POSITIVE_INFINITY
      return Math.max(
        ...(['x', 'y', 'width', 'height'] as const).map((key) =>
          Math.abs(a[key] - b[key])
        )
      )
    })
    .toBeLessThan(1)
}
