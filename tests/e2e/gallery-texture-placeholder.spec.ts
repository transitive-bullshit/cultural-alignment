import { expect, test, type Route } from '@playwright/test'

test('WebGL gallery swaps embedded placeholders for full textures', async ({
  page
}) => {
  const heldFullImages = new Set<Route>()
  const fullImageRoute = (url: URL) => url.pathname === '/_next/image'
  const holdFullImage = (route: Route) => {
    heldFullImages.add(route)
  }

  await page.route(fullImageRoute, holdFullImage)

  try {
    await page.goto('/scenarios', { waitUntil: 'domcontentloaded' })

    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')
    await expect(canvas).toBeVisible()
    await expect
      .poll(async () =>
        Number(
          (await canvas.getAttribute('data-gallery-placeholder-textures')) ?? 0
        )
      )
      .toBeGreaterThan(0)
    await expect(canvas).toHaveAttribute('data-gallery-full-textures', '0')

    await page.unroute(fullImageRoute, holdFullImage)
    await Promise.allSettled(
      [...heldFullImages].map((route) => route.continue())
    )

    await expect
      .poll(async () =>
        Number((await canvas.getAttribute('data-gallery-full-textures')) ?? 0)
      )
      .toBeGreaterThan(0)
  } finally {
    await page.unroute(fullImageRoute, holdFullImage)
    await Promise.allSettled([...heldFullImages].map((route) => route.abort()))
  }
})
