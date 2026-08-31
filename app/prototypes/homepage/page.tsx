import type { Metadata } from 'next'

import { toSpatialGalleryItems } from '@/features/spatial-gallery/gallery-items'
import { contentCatalog } from '@/lib/content/snapshot'

import { HomepagePrototype } from './homepage-prototype'
import type { PrototypeScenario } from './prototype-types'

export const metadata: Metadata = {
  title: 'Homepage prototypes',
  description: 'Explorations for introducing the Cultural Alignment archive.',
  robots: { index: false, follow: false }
}

const exampleSlugs = [
  'lacie-games-her-rating',
  'keep-summer-safe',
  'auto-enforces-directive-a113',
  'life-finds-a-way'
] as const

const scenarioCards = contentCatalog.listScenarioCards()
const galleryItems = toSpatialGalleryItems(scenarioCards)
const initialItem =
  galleryItems.find(({ slug }) => slug === 'lacie-games-her-rating') ??
  galleryItems[0]
const examples = exampleSlugs.map((slug): PrototypeScenario => {
  const scenario = contentCatalog.getScenarioPage(slug)
  if (!scenario) throw new Error(`Missing homepage prototype scenario: ${slug}`)

  return {
    id: scenario.id,
    slug: scenario.slug,
    href: `/scenarios/${scenario.slug}`,
    title: scenario.title,
    source: scenario.source.title,
    releaseYear: scenario.releaseDate?.slice(0, 4) ?? 'Undated',
    scene: scenario.scene,
    analogy: scenario.whyAnalogyWorks,
    concepts: scenario.concepts.map(({ title }) => title),
    riskFamilies: scenario.riskFamilies.map(({ title }) => title),
    image: {
      src: scenario.image.detailSrc,
      alt: scenario.image.alt,
      blurDataURL: scenario.image.blurDataURL,
      width: scenario.image.width,
      height: scenario.image.height
    }
  }
})

export default async function HomepagePrototypePage({
  searchParams
}: {
  readonly searchParams: Promise<{
    readonly v?: string | readonly string[]
  }>
}) {
  if (!initialItem) {
    throw new Error('Homepage prototypes require at least one scenario')
  }

  const requestedVariant = (await searchParams).v
  const rawVariant = Array.isArray(requestedVariant)
    ? requestedVariant[0]
    : requestedVariant
  const parsedVariant = Number.parseInt(rawVariant ?? '1', 10)
  const initialVariant = Number.isInteger(parsedVariant)
    ? Math.min(4, Math.max(1, parsedVariant)) - 1
    : 0

  return (
    <HomepagePrototype
      examples={examples}
      galleryItems={galleryItems}
      initialItemId={initialItem.id}
      initialVariant={initialVariant}
      scenarioCount={galleryItems.length}
    />
  )
}
