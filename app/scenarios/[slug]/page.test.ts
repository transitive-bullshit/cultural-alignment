import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import { siteUrl } from '@/lib/site'

import { dynamicParams, generateMetadata, generateStaticParams } from './page'

describe('production scenario route', () => {
  it('prebuilds every scenario and rejects unknown dynamic params', () => {
    const expectedParams = contentCatalog
      .getStaticSlugs('scenario')
      .map((slug) => ({ slug }))

    expect(dynamicParams).toBe(false)
    expect(generateStaticParams()).toEqual(expectedParams)
    expect(new Set(expectedParams.map(({ slug }) => slug)).size).toBe(
      expectedParams.length
    )
  })

  it('publishes production route metadata', async () => {
    const slug = contentCatalog.getStaticSlugs('scenario')[0]!
    const scenario = contentCatalog.getScenarioPage(slug)!
    const metadata = await generateMetadata(
      {
        params: Promise.resolve({ slug }),
        searchParams: Promise.resolve({})
      },
      Promise.resolve({
        openGraph: { images: [{ url: 'https://example.com/global.jpg' }] }
      }) as ResolvingMetadata
    )

    expect(metadata.title).toEqual({
      absolute: `${scenario.source.title} / ${scenario.title}`
    })
    expect(metadata.description).toBe(scenario.scene)
    expect(metadata.alternates?.canonical).toBe(`/scenarios/${slug}`)
    expect(metadata.keywords).toContain(scenario.source.title)

    const images = metadata.openGraph?.images
    const image = Array.isArray(images) ? images[0] : images
    const imageUrl =
      image instanceof URL
        ? image
        : typeof image === 'object'
          ? image?.url
          : image

    expect(new URL(String(imageUrl)).href).toBe(
      new URL(scenario.image.detailSrc, siteUrl).href
    )
  })
})
