import { expect, test } from '@playwright/test'

import franchises from '../../content/snapshot/franchises.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

import { mockOptimizedImages } from './image-fixtures'

const source = sources.find(({ poster, releaseDate }) => poster && releaseDate)

if (!source) {
  throw new Error('Expected a media source with a poster and release date')
}

const franchise = franchises[0]

if (!franchise) {
  throw new Error('Expected a media franchise')
}

const resources = [
  { kind: 'source', route: 'sources', slug: source.slug },
  { kind: 'franchise', route: 'franchises', slug: franchise.slug }
] as const

for (const resource of resources) {
  test(`${resource.kind} detail publishes its generated social image`, async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto(`/${resource.route}/${resource.slug}`)

    await expect(
      page.locator(`[data-resource-detail="${resource.kind}"]`)
    ).toBeVisible()

    const expectedPath = `/${resource.route}/${resource.slug}/opengraph-image`
    const openGraphImage = page.locator('meta[property="og:image"]')
    const twitterImage = page.locator('meta[name="twitter:image"]')

    await expect(openGraphImage).toHaveAttribute('content', /\S/)
    await expect(twitterImage).toHaveAttribute('content', /\S/)

    const openGraphImageUrl = new URL(
      (await openGraphImage.getAttribute('content'))!
    )
    const twitterImageUrl = new URL(
      (await twitterImage.getAttribute('content'))!
    )

    expect(openGraphImageUrl.pathname).toBe(expectedPath)
    expect(twitterImageUrl.pathname).toBe(expectedPath)
    await expect(
      page.locator('meta[property="og:image:type"]')
    ).toHaveAttribute('content', 'image/png')
    await expect(
      page.locator('meta[property="og:image:width"]')
    ).toHaveAttribute('content', '1200')
    await expect(
      page.locator('meta[property="og:image:height"]')
    ).toHaveAttribute('content', '630')
  })
}
