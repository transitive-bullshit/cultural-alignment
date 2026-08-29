import sharp from 'sharp'

const BLUR_PLACEHOLDER_WIDTH = 8

export async function createBlurDataURL(input: Uint8Array): Promise<string> {
  const placeholder = await sharp(input)
    .rotate()
    .resize({
      width: BLUR_PLACEHOLDER_WIDTH,
      withoutEnlargement: true
    })
    .webp({ quality: 35, effort: 6 })
    .toBuffer()

  return `data:image/webp;base64,${placeholder.toString('base64')}`
}
