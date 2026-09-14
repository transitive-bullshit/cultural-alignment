import sharp from 'sharp'

import type { ContentImage } from '@/lib/content/catalog'

import { focalPointToObjectPosition } from './crop'

// Crop before rendering so social images retain the same focal framing across engines.
export async function toSocialImageDataUrl(
  image: ContentImage,
  width: number,
  height: number
) {
  focalPointToObjectPosition(image.focalPoint)
  const response = await fetch(image.detailSrc, { cache: 'force-cache' })

  if (!response.ok) {
    throw new Error(
      `Could not load social image: ${response.status} ${response.statusText}`
    )
  }

  const { data, info } = await sharp(await response.arrayBuffer())
    .resize({ width, height, fit: 'outside' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const focalPoint = image.focalPoint ?? { x: 0.5, y: 0.5 }
  const jpeg = await sharp(data, { raw: info })
    .extract({
      left: Math.round((info.width - width) * focalPoint.x),
      top: Math.round((info.height - height) * focalPoint.y),
      width,
      height
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
