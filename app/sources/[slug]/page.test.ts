import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import { dynamicParams, generateMetadata, generateStaticParams } from './page'

describe('production media source route', () => {
  it('prebuilds every media source and rejects unknown dynamic params', () => {
    const expectedParams = contentCatalog
      .getStaticSlugs('source')
      .map((slug) => ({ slug }))

    expect(dynamicParams).toBe(false)
    expect(generateStaticParams()).toEqual(expectedParams)
    expect(new Set(expectedParams.map(({ slug }) => slug)).size).toBe(
      expectedParams.length
    )
  })

  it('leaves image metadata to the colocated Open Graph image route', async () => {
    const slug = contentCatalog.getStaticSlugs('source')[0]!
    const source = contentCatalog.getResourcePage('source', slug)!
    const metadata = await generateMetadata(
      {
        params: Promise.resolve({ slug })
      },
      Promise.resolve({
        openGraph: { images: [{ url: 'https://example.com/global.jpg' }] }
      }) as ResolvingMetadata
    )

    expect(metadata.alternates?.canonical).toBe(source.href)
    expect(metadata.openGraph?.images).toBeUndefined()
  })
})
