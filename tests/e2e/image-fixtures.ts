import type { Page, Route } from '@playwright/test'

export const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

export function fulfillOnePixelImage(route: Route) {
  return route.fulfill({
    body: onePixelPng,
    contentType: 'image/png',
    status: 200
  })
}

export async function mockOptimizedImages(page: Page) {
  await page.route(
    (url) => url.pathname === '/_next/image',
    fulfillOnePixelImage
  )
}
