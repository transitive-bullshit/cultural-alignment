import type { GalleryScenario } from '@/lib/content/catalog'

import type { SpatialGalleryItem } from './types'

export function toSpatialGalleryItems(
  scenarios: readonly GalleryScenario[]
): readonly SpatialGalleryItem[] {
  return scenarios.map((scenario) => ({
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
      src: scenario.image.gallerySrc,
      alt: scenario.image.alt,
      width: scenario.image.width,
      height: scenario.image.height,
      focalPoint: scenario.image.focalPoint
    }
  }))
}
