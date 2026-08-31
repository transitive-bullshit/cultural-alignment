import { expect, test } from '@playwright/test'

test('Escape dismisses the signal loader and focuses the archive', async ({
  page
}) => {
  await page.goto('/')

  const loader = page.locator('[data-homepage-signal-loader]')
  const intro = page.locator('[data-signal-loader-intro]')
  const galleryMain = page.locator('[data-gallery-main]')

  await expect(intro).toBeVisible()
  await expect(loader).toHaveAttribute('data-intro-active', '')

  await page.keyboard.press('Escape')

  await expect(intro).toHaveCount(0)
  await expect(loader).not.toHaveAttribute('data-intro-active', '')
  await expect(galleryMain).toBeFocused()
})

test.describe('gallery motion', () => {
  test.describe.configure({ mode: 'serial' })

  test('keeps the initial coast under the loader and adds a dismissal burst', async ({
    page
  }) => {
    await page.goto('/')

    const enterArchive = page.locator('[data-signal-loader-enter]')
    const galleryMain = page.locator('[data-gallery-main]')
    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-intro-motion',
      /^(running|settled)$/,
      { timeout: 15_000 }
    )
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending'
    )

    await enterArchive.click()

    await expect(enterArchive).toHaveCount(0)
    await expect(galleryMain).toBeFocused()
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      /^(launched|settled)$/
    )
  })

  test('reduced motion reveals the archive without positional motion', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const enterArchive = page.locator('[data-signal-loader-enter]')
    const galleryMain = page.locator('[data-gallery-main]')
    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-intro-motion',
      'skipped',
      { timeout: 15_000 }
    )
    await enterArchive.click()

    await expect(enterArchive).toHaveCount(0)
    await expect(galleryMain).toBeFocused()
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'skipped'
    )
  })
})
