import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { createBlurDataURL } from './image-placeholder'

describe('createBlurDataURL', () => {
  it('serializes a succinct WebP no wider than eight pixels', async () => {
    const input = await sharp({
      create: {
        width: 160,
        height: 90,
        channels: 3,
        background: { r: 38, g: 76, b: 114 }
      }
    })
      .png()
      .toBuffer()

    const dataURL = await createBlurDataURL(input)
    const encoded = dataURL.replace('data:image/webp;base64,', '')
    const placeholder = Buffer.from(encoded, 'base64')
    const metadata = await sharp(placeholder).metadata()

    expect(dataURL).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/)
    expect(dataURL.length).toBeLessThanOrEqual(512)
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(8)
    expect(metadata.height).toBe(5)
  })
})
