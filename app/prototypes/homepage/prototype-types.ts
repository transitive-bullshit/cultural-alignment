import type { SpatialGalleryItem } from '@/features/spatial-gallery/types'

export type PrototypeScenario = Readonly<{
  id: string
  slug: string
  href: string
  title: string
  source: string
  releaseYear: string
  scene: string
  analogy: string
  concepts: readonly string[]
  riskFamilies: readonly string[]
  image: Readonly<{
    src: string
    alt: string
    blurDataURL: string
    width: number
    height: number
  }>
}>

export type HomepageVariantProps = Readonly<{
  examples: readonly PrototypeScenario[]
  galleryItems: readonly SpatialGalleryItem[]
  initialItemId: string
  scenarioCount: number
}>
