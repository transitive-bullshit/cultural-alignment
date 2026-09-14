import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'

import type { ContentImage } from '@/lib/content/catalog'

import { toSocialImageDataUrl } from './social-image'

afterEach(() => vi.restoreAllMocks())

it.each(['horizontal', 'vertical'] as const)(
  'preserves %s focal framing in the prepared image',
  async (axis) => {
    const horizontal = axis === 'horizontal'
    const bands = await Promise.all(
      ['#ff0000', '#00ff00', '#0000ff'].map((background) =>
        sharp({ create: { width: 40, height: 40, channels: 3, background } })
          .png()
          .toBuffer()
      )
    )
    const source = await sharp({
      create: {
        width: horizontal ? 120 : 40,
        height: horizontal ? 40 : 120,
        channels: 3,
        background: 'white'
      }
    })
      .composite(
        bands.map((input, index) => ({
          input,
          left: horizontal ? index * 40 : 0,
          top: horizontal ? 0 : index * 40
        }))
      )
      .png()
      .toBuffer()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(source)
    )

    for (const [index, position] of [0, 0.5, 1].entries()) {
      const image: ContentImage = {
        gallerySrc: 'https://example.com/gallery.webp',
        detailSrc: 'https://example.com/detail.webp',
        width: horizontal ? 120 : 40,
        height: horizontal ? 40 : 120,
        alt: '',
        blurDataURL: '',
        focalPoint: horizontal
          ? { x: position, y: 0.5 }
          : { x: 0.5, y: position }
      }
      const dataUrl = await toSocialImageDataUrl(image, 40, 40)
      const bytes = Buffer.from(dataUrl.split(',')[1]!, 'base64')
      const { data, info } = await sharp(bytes)
        .raw()
        .toBuffer({ resolveWithObject: true })
      expect(info.width).toBe(40)
      expect(info.height).toBe(40)
      const center = (20 * 40 + 20) * info.channels
      expect(data[center + index]).toBeGreaterThan(240)
      expect(data[center + ((index + 1) % 3)]).toBeLessThan(15)
    }
  }
)
