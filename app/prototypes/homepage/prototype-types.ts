import type { SpatialGalleryItem } from '@/features/spatial-gallery/types'

export type PrototypeScenario = Readonly<{
  id: string
  slug: string
  href: string
  title: string
  source: string
  releaseYear: string
  splitLens: Readonly<{
    sceneCue: string
    concept: string
    connection: string
  }>
  image: Readonly<{
    src: string
    alt: string
    blurDataURL: string
    width: number
    height: number
  }>
}>

export type PrototypeGalleryItem = SpatialGalleryItem &
  Readonly<{
    concept: string
  }>

export type HomepageVariantProps = Readonly<{
  examples: readonly PrototypeScenario[]
  galleryItems: readonly PrototypeGalleryItem[]
  initialItemId: string
  scenarioCount: number
}>

export type HomepagePrototypeRuntimeProps = HomepageVariantProps &
  Readonly<{
    introDismissed: boolean
    onDismissIntro(): void
  }>

export const homepagePrototypeManifest = [
  { id: 'signal-loader', name: 'Signal Loader', pickerLabel: 'Load' },
  { id: 'split-lens', name: 'Split Lens', pickerLabel: 'Split' },
  { id: 'match-cuts', name: 'Match Cuts', pickerLabel: 'Cuts' },
  {
    id: 'words',
    name: 'Words',
    pickerLabel: 'Words'
  }
] as const

export type HomepagePrototypeId =
  (typeof homepagePrototypeManifest)[number]['id']
