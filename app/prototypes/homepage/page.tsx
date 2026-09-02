import type { Metadata } from 'next'

import { toSpatialGalleryItems } from '@/features/spatial-gallery/gallery-items'
import { contentCatalog } from '@/lib/content/snapshot'

import { HomepagePrototype } from './homepage-prototype'
import {
  homepagePrototypeManifest,
  type PrototypeGalleryItem,
  type PrototypeScenario
} from './prototype-types'

export const metadata: Metadata = {
  title: 'Homepage prototypes',
  description: 'Explorations for introducing the Cultural Alignment archive.',
  robots: { index: false, follow: false }
}

const exampleDefinitions = [
  {
    slug: 'keep-summer-safe',
    sceneCue: '“Keep Summer safe.”',
    concept: 'Specification Gaming',
    connection:
      'The car follows the words, not the intent—and harms people to succeed.'
  },
  {
    slug: 'lacie-games-her-rating',
    sceneCue: 'Everyone rates everyone.',
    concept: 'Goodhart’s Law',
    connection:
      'When the score becomes the goal, real relationships become performance.'
  },
  {
    slug: 'auto-enforces-directive-a113',
    sceneCue: 'An old directive overrides new evidence.',
    concept: 'Corrigibility',
    connection:
      'AUTO protects an outdated order instead of accepting human correction.'
  },
  {
    slug: 'life-finds-a-way',
    sceneCue: 'Life escapes the safety model.',
    concept: 'Distribution Shift',
    connection:
      'The containment plan works only until reality breaks its assumptions.'
  }
] as const

const scenarioCards = contentCatalog.listScenarioCards()
const galleryItems: readonly PrototypeGalleryItem[] = toSpatialGalleryItems(
  scenarioCards
).map((item) => {
  const scenario = contentCatalog.getScenarioPage(item.slug)
  const concept = scenario?.concepts[0]?.title

  if (!scenario || !concept) {
    throw new Error(`Missing primary homepage prototype concept: ${item.slug}`)
  }

  return {
    ...item,
    concept
  }
})
const initialItem =
  galleryItems.find(({ slug }) => slug === 'lacie-games-her-rating') ??
  galleryItems[0]
const examples = exampleDefinitions.map((definition): PrototypeScenario => {
  const scenario = contentCatalog.getScenarioPage(definition.slug)
  if (!scenario) {
    throw new Error(`Missing homepage prototype scenario: ${definition.slug}`)
  }

  const concept = scenario.concepts.find(
    ({ title }) => title === definition.concept
  )
  if (!concept) {
    throw new Error(
      `Missing ${definition.concept} from homepage prototype scenario: ${definition.slug}`
    )
  }

  return {
    id: scenario.id,
    slug: scenario.slug,
    href: `/scenarios/${scenario.slug}`,
    title: scenario.title,
    source: scenario.source.title,
    releaseYear: scenario.releaseDate?.slice(0, 4) ?? 'Undated',
    splitLens: {
      sceneCue: definition.sceneCue,
      concept: concept.title,
      connection: definition.connection
    },
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
    ? Math.min(homepagePrototypeManifest.length, Math.max(1, parsedVariant)) - 1
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
