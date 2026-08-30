import { expect, test, type Route } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

const gallerySourceUrls = [
  ...new Set(scenarios.map((scenario) => scenario.image.gallerySrc))
]
const gallerySourceUrlSet = new Set(gallerySourceUrls)
const galleryTextureCount = gallerySourceUrls.length
const desktopTextureBindingLimit = 256
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

const fullImageRoute = (url: URL) =>
  url.pathname === '/_next/image' &&
  gallerySourceUrlSet.has(url.searchParams.get('url') ?? '')

test('WebGL gallery swaps embedded placeholders for full textures', async ({
  page
}) => {
  const heldFullImages = new Set<Route>()
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
      [...heldFullImages].map((route) => fulfillGalleryImage(route))
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

test('loaded gallery textures remain available across a scroll round trip', async ({
  page
}) => {
  let fullImageRequestCount = 0
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(fullImageRoute, async (route) => {
    fullImageRequestCount += 1
    await fulfillGalleryImage(route)
  })
  await page.goto('/scenarios', { waitUntil: 'domcontentloaded' })

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(
      async () =>
        Number((await canvas.getAttribute('data-gallery-full-textures')) ?? 0),
      { timeout: 15_000 }
    )
    .toBe(galleryTextureCount)
  await expect(canvas).toHaveAttribute('data-gallery-placeholder-textures', '0')
  await expect(canvas).toHaveAttribute(
    'data-gallery-binding-limit',
    String(desktopTextureBindingLimit)
  )
  await expect(canvas).toHaveAttribute(
    'data-gallery-bound-textures',
    String(desktopTextureBindingLimit)
  )

  await expect(gallery).not.toHaveAttribute('data-selected-scenario-id')
  await expect(
    gallery.locator('[data-selected-scenario-metadata]')
  ).toHaveCount(0)

  await canvas.hover()
  await expect(gallery).toHaveAttribute('data-selected-scenario-id', /.+/)

  const initialSelectedId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )
  if (!initialSelectedId) throw new Error('Expected a selected scenario ID')
  const requestsAfterIdleLoad = fullImageRequestCount

  await canvas.hover()
  await page.mouse.wheel(0, 3_000)
  await expect(gallery).not.toHaveAttribute(
    'data-selected-scenario-id',
    initialSelectedId
  )
  const forwardSelectedId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )
  if (!forwardSelectedId) throw new Error('Expected a selected scenario ID')

  await page.mouse.wheel(0, -3_000)
  await expect(gallery).not.toHaveAttribute(
    'data-selected-scenario-id',
    forwardSelectedId
  )

  await expect(canvas).toHaveAttribute(
    'data-gallery-full-textures',
    String(galleryTextureCount)
  )
  await expect(canvas).toHaveAttribute('data-gallery-placeholder-textures', '0')
  expect(fullImageRequestCount).toBe(requestsAfterIdleLoad)
})

async function fulfillGalleryImage(route: Route) {
  await route.fulfill({
    body: onePixelPng,
    contentType: 'image/png',
    status: 200
  })
}
