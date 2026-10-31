import { expect, test } from '@playwright/test'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import franchises from '../../content/snapshot/franchises.json' with { type: 'json' }
import families from '../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

// Inspect what a crawler receives before JavaScript, including metadata that
// Next.js resolves from the root template and file-based social images.
test.use({ javaScriptEnabled: false })

const paths = [
  '/',
  '/scenarios',
  '/sources',
  '/franchises',
  '/risk-families',
  '/concepts',
  '/about',
  '/privacy',
  `/scenarios/${scenarios[0]!.slug}`,
  `/sources/${sources[0]!.slug}`,
  `/franchises/${franchises[0]!.slug}`,
  `/risk-families/${families[0]!.slug}`,
  `/concepts/${concepts[0]!.slug}`
]

for (const path of paths) {
  test(`${path} exposes consistent search and sharing metadata`, async ({
    page,
    baseURL
  }) => {
    const response = await page.goto(`${path}?utm_source=seo-check`, {
      waitUntil: 'domcontentloaded'
    })
    expect(response?.status()).toBe(200)

    const canonical = page.locator('head link[rel="canonical"]')
    const openGraphUrl = page.locator('head meta[property="og:url"]')
    const expectedUrl = new URL(path, baseURL).href
    await expect(canonical).toHaveCount(1)
    expect(new URL((await canonical.getAttribute('href'))!).href).toBe(
      expectedUrl
    )
    await expect(openGraphUrl).toHaveCount(1)
    expect(new URL((await openGraphUrl.getAttribute('content'))!).href).toBe(
      expectedUrl
    )

    const title = await page.title()
    expect(title).toContain('Cultural Alignment')
    await expect(
      page.locator('head meta[property="og:title"]')
    ).toHaveAttribute('content', title)
    await expect(
      page.locator('head meta[name="twitter:title"]')
    ).toHaveAttribute('content', title)

    const description = await page
      .locator('head meta[name="description"]')
      .getAttribute('content')
    expect(description).toBeTruthy()
    await expect(
      page.locator('head meta[property="og:description"]')
    ).toHaveAttribute('content', description!)
    await expect(
      page.locator('head meta[name="twitter:description"]')
    ).toHaveAttribute('content', description!)

    const image = await page
      .locator('head meta[property="og:image"]')
      .getAttribute('content')
    expect(new URL(image!).origin).toBe(new URL(baseURL!).origin)
    expect(new URL(image!).pathname).toBe(
      path.split('/').length === 3
        ? `${path}/opengraph-image`
        : '/opengraph-image.jpg'
    )
    await expect(
      page.locator('head meta[name="twitter:image"]')
    ).toHaveAttribute('content', image!)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      'content',
      'max-image-preview:large'
    )
    expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/i)
  })
}
