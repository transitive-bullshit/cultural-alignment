import rawMemeIdeas from '@/data/meme-review/ideas.json'
import { contentCatalog } from '@/lib/content/snapshot'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import {
  memeIdeaCollectionSchema,
  type MemeIdea,
  type ScenarioMemeIdeas
} from './schema'

export type MemeReviewScenario = {
  readonly slug: string
  readonly title: string
  readonly href: string
  readonly episodeLabel: string | null
  readonly source: {
    readonly slug: string
    readonly title: string
  }
  readonly image: {
    readonly src: string
    readonly alt: string
    readonly width: number
    readonly height: number
    readonly blurDataURL: string
    readonly objectPosition: string
  }
  readonly ideas: readonly MemeIdea[]
}

export type MemeReviewSource = {
  readonly slug: string
  readonly title: string
  readonly scenarios: readonly MemeReviewScenario[]
}

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

export const memeIdeaCollection = memeIdeaCollectionSchema.parse(rawMemeIdeas)

export const memeIdeaIds = new Set(
  memeIdeaCollection.flatMap(({ ideas }) => ideas.map(({ id }) => id))
)

export function buildMemeReviewSources(
  ideaCollection: readonly ScenarioMemeIdeas[] = memeIdeaCollection
): readonly MemeReviewSource[] {
  const featuredCards = contentCatalog.listScenarioCards({
    featuredOnly: true
  })
  const featuredSlugs = new Set(featuredCards.map(({ slug }) => slug))
  const ideasByScenarioSlug = new Map(
    ideaCollection.map((scenario) => [scenario.scenario_slug, scenario])
  )

  const missingScenarioSlugs = featuredCards.flatMap(({ slug }) =>
    ideasByScenarioSlug.has(slug) ? [] : [slug]
  )
  const unfeaturedScenarioSlugs = ideaCollection.flatMap(({ scenario_slug }) =>
    featuredSlugs.has(scenario_slug) ? [] : [scenario_slug]
  )

  if (missingScenarioSlugs.length || unfeaturedScenarioSlugs.length) {
    throw new Error(
      [
        missingScenarioSlugs.length
          ? `Featured scenarios without meme ideas: ${missingScenarioSlugs.join(', ')}`
          : null,
        unfeaturedScenarioSlugs.length
          ? `Meme ideas for non-featured scenarios: ${unfeaturedScenarioSlugs.join(', ')}`
          : null
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  const scenarios = featuredCards
    .map((card): MemeReviewScenario => {
      const scenario = contentCatalog.getScenarioPage(card.slug)
      const ideaGroup = ideasByScenarioSlug.get(card.slug)

      if (!scenario || !ideaGroup) {
        throw new Error(`Missing meme review scenario: ${card.slug}`)
      }

      const conceptTitles = new Set(scenario.concepts.map(({ title }) => title))
      const unknownConcepts = ideaGroup.ideas
        .map(({ ai_concept }) => ai_concept)
        .filter((concept) => !conceptTitles.has(concept))

      if (unknownConcepts.length) {
        throw new Error(
          `Unknown AI concepts for ${card.slug}: ${unknownConcepts.join(', ')}`
        )
      }

      return {
        slug: scenario.slug,
        title: scenario.title,
        href: card.href,
        episodeLabel: scenario.episode?.label ?? null,
        source: {
          slug: scenario.source.slug,
          title: scenario.source.title
        },
        image: {
          src: scenario.image.gallerySrc,
          alt: scenario.image.alt,
          width: scenario.image.width,
          height: scenario.image.height,
          blurDataURL: scenario.image.blurDataURL,
          objectPosition: focalPointToObjectPosition(scenario.image.focalPoint)
        },
        ideas: ideaGroup.ideas
      }
    })
    .toSorted(
      (left, right) =>
        collator.compare(left.source.title, right.source.title) ||
        collator.compare(left.title, right.title)
    )

  const sources = new Map<string, MemeReviewSource>()

  for (const scenario of scenarios) {
    const existing = sources.get(scenario.source.slug)

    if (existing) {
      sources.set(scenario.source.slug, {
        ...existing,
        scenarios: [...existing.scenarios, scenario]
      })
    } else {
      sources.set(scenario.source.slug, {
        slug: scenario.source.slug,
        title: scenario.source.title,
        scenarios: [scenario]
      })
    }
  }

  return [...sources.values()]
}
