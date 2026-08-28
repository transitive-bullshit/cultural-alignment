import { getImageProps } from 'next/image'

import type { GalleryScenario } from '@/lib/content/catalog'

import type { SpatialGalleryItem } from './types'

// A single logical size keeps WebGL on one reusable density-aware cache variant.
const GALLERY_TEXTURE_RENDER_WIDTH = 320
const GALLERY_TEXTURE_QUALITY = 75

export function toSpatialGalleryItems(
  scenarios: readonly GalleryScenario[]
): readonly SpatialGalleryItem[] {
  return scenarios.map((scenario) => {
    const textureHeight = Math.max(
      1,
      Math.round(
        (GALLERY_TEXTURE_RENDER_WIDTH * scenario.image.height) /
          scenario.image.width
      )
    )
    const { props } = getImageProps({
      src: scenario.image.gallerySrc,
      alt: scenario.image.alt,
      width: GALLERY_TEXTURE_RENDER_WIDTH,
      height: textureHeight,
      quality: GALLERY_TEXTURE_QUALITY
    })

    return {
      id: scenario.id,
      href: scenario.href,
      slug: scenario.slug,
      title: scenario.title,
      source: scenario.source.title,
      releaseYear: scenario.releaseDate?.slice(0, 4) ?? 'Undated',
      lens:
        scenario.riskFamilies.map(({ title }) => title).join(' · ') ||
        'Unclassified',
      image: {
        // Use Next's public helper so WebGL shares the same image optimizer and
        // cache keys as ordinary Next images without hard-coding /_next/image.
        src: props.src,
        alt: scenario.image.alt,
        width: scenario.image.width,
        height: scenario.image.height,
        focalPoint: scenario.image.focalPoint
      }
    }
  })
}
