import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import Image, { contentType, size } from './opengraph-image'

const originalFetch = globalThis.fetch

afterEach(() => {
  vi.restoreAllMocks()
})

describe('media source Open Graph image', () => {
  it('renders the route image contract from the source poster', async () => {
    const source = contentCatalog
      .getStaticSlugs('source')
      .map((slug) => contentCatalog.getResourcePage('source', slug))
      .find(
        (candidate) =>
          candidate?.kind === 'source' &&
          candidate.poster &&
          candidate.releaseDate
      )

    if (source?.kind !== 'source' || !source.poster) {
      throw new Error('Expected a media source with a poster and release date')
    }

    const poster = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: '#ff4d1f'
      }
    })
      .png()
      .toBuffer()
    const posterUrl = source.poster.detailSrc
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (...args) => {
        const input = args[0]
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url

        if (url === posterUrl) {
          return new Response(poster, {
            headers: { 'content-type': 'image/png' }
          })
        }

        return originalFetch(...args)
      })

    const response = await Image({
      params: Promise.resolve({ slug: source.slug })
    })
    const image = await response.arrayBuffer()
    const metadata = await sharp(image).metadata()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(contentType)
    expect(metadata.width).toBe(size.width)
    expect(metadata.height).toBe(size.height)
    expect(
      fetchSpy.mock.calls.filter(([input]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url

        return url === posterUrl
      })
    ).toHaveLength(1)
  })
})
