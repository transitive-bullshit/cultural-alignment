import { expect, test } from '@playwright/test'

test('keeps gallery media visible while detail media loads', async ({
  page
}) => {
  let releaseDetailImage = () => {}
  const detailImageGate = new Promise<void>((resolve) => {
    releaseDetailImage = resolve
  })

  await page.route(
    (url) =>
      url.pathname === '/_next/image' &&
      (url.searchParams.get('url')?.includes('/detail-') ?? false),
    async (route) => {
      await detailImageGate
      await route.continue()
    }
  )

  await page.goto('/scenarios')
  await expect(
    page.locator('[data-gallery-transition-ready="true"]')
  ).toBeVisible()
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const preview = document.querySelector<HTMLImageElement>(
        '[data-scenario-transition-preview]'
      )
      if (!preview) return

      document.documentElement.dataset.transitionPreviewAtInsertion =
        JSON.stringify({
          complete: preview.complete,
          naturalWidth: preview.naturalWidth
        })
      observer.disconnect()
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  })

  try {
    await page.getByRole('link', { name: 'Open this scenario' }).click()
    await expect(page).toHaveURL(/\/scenarios\/[^/]+$/)

    const media = page.locator('[data-scenario-media]')
    await expect(media).toBeVisible()

    const transitionPreview = media.locator(
      '[data-scenario-transition-preview]'
    )
    await expect(transitionPreview).toBeVisible()

    await expect
      .poll(() =>
        page.evaluate(() => {
          const pseudoElements = document
            .getAnimations()
            .flatMap((animation) => {
              const pseudoElement = (animation.effect as KeyframeEffect | null)
                ?.pseudoElement

              return pseudoElement ? [pseudoElement] : []
            })

          return (
            pseudoElements.some((name) =>
              name.startsWith('::view-transition-old(scenario-media-')
            ) &&
            pseudoElements.some((name) =>
              name.startsWith('::view-transition-new(scenario-media-')
            )
          )
        })
      )
      .toBe(true)

    const insertionState = await page.evaluate(() => {
      const serialized =
        document.documentElement.dataset.transitionPreviewAtInsertion

      return serialized
        ? (JSON.parse(serialized) as {
            complete: boolean
            naturalWidth: number
          })
        : null
    })
    expect(insertionState?.complete).toBe(true)
    expect(insertionState?.naturalWidth).toBeGreaterThan(0)

    await expect
      .poll(
        () =>
          transitionPreview.evaluate(
            (image) => (image as HTMLImageElement).naturalWidth
          ),
        { timeout: 1_000 }
      )
      .toBeGreaterThan(0)
  } finally {
    releaseDetailImage()
  }

  const detailImage = page.locator(
    '[data-scenario-media] img:not([data-scenario-transition-preview])'
  )

  await expect
    .poll(() =>
      detailImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0)
  await expect(page.locator('[data-scenario-transition-preview]')).toHaveCount(
    0
  )
})

test('direct detail loads do not mount the gallery preview', async ({
  page
}) => {
  await page.goto('/scenarios')
  const href = await page
    .getByRole('link', { name: 'Open this scenario' })
    .getAttribute('href')

  if (!href) throw new Error('The selected gallery scenario requires a link')
  await page.goto(href)

  const media = page.locator('[data-scenario-media]')
  await expect(media).toBeVisible()
  await expect(media.locator('[data-scenario-transition-preview]')).toHaveCount(
    0
  )

  const detailImage = media.locator('img')
  await expect
    .poll(() =>
      detailImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0)
  expect(await detailImage.getAttribute('src')).toContain('detail-')
})
