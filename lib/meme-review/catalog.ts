import { contentCatalog } from '@/lib/content/snapshot'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import {
  buildMemePreviewHistory,
  type MemePreviewHistory,
  type MemeReviewImage
} from './history'
import { loadMemeReviewWorkspace, type MemeReviewWorkspace } from './rounds'
import type { MemeIdeaV2, MemeReviewAsset, ScenarioMemeIdeasV2 } from './schema'
import type { MemeReviewBatchStatus } from './schema'

export type MemeReviewScenario = {
  readonly slug: string
  readonly title: string
  readonly href: string
  readonly featured: boolean
  readonly episodeLabel: string | null
  readonly source: {
    readonly slug: string
    readonly title: string
  }
  readonly image: MemeReviewImage
  readonly assets: readonly MemeReviewAsset[]
  readonly ideas: readonly MemeIdeaV2[]
}

export type MemeReviewSource = {
  readonly slug: string
  readonly title: string
  readonly scenarios: readonly MemeReviewScenario[]
}

export type MemeReviewCatalog = {
  readonly sources: readonly MemeReviewSource[]
  readonly historyByIdeaId: MemePreviewHistory
  readonly ideaIds: ReadonlySet<string>
  readonly scenarioSlugs: ReadonlySet<string>
  readonly reviewableIdeaIds: ReadonlySet<string>
  readonly reviewableScenarioSlugs: ReadonlySet<string>
  readonly activeBatch: number
  readonly activeRevisionKey: string
  readonly activeRevisionLabel: string
  readonly status: MemeReviewBatchStatus
  readonly feedbackPath: string
}

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

export async function loadMemeReviewCatalog(
  workspace?: MemeReviewWorkspace
): Promise<MemeReviewCatalog> {
  const resolvedWorkspace = workspace ?? (await loadMemeReviewWorkspace())
  const { activeBatch, historySnapshots, feedbackPath } = resolvedWorkspace
  const sources = buildMemeReviewSources(activeBatch.ideas, activeBatch.assets)
  const scenarioSlugs = new Set(
    activeBatch.ideas.map(({ scenario_slug }) => scenario_slug)
  )
  const configuredReviewableSlugs = new Set(
    activeBatch.status.reviewable_scenarios.filter((scenarioSlug) =>
      scenarioSlugs.has(scenarioSlug)
    )
  )

  const reviewableScenarioSlugs =
    activeBatch.status.status === 'ready'
      ? scenarioSlugs
      : configuredReviewableSlugs
  const reviewableIdeaIds = new Set(
    activeBatch.ideas.flatMap(({ scenario_slug, ideas }) =>
      reviewableScenarioSlugs.has(scenario_slug)
        ? ideas.map(({ id }) => id)
        : []
    )
  )

  return {
    sources,
    historyByIdeaId: buildMemePreviewHistory({
      activeIdeas: activeBatch.ideas,
      historySnapshots
    }),
    ideaIds: new Set(
      activeBatch.ideas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
    ),
    scenarioSlugs,
    reviewableIdeaIds,
    reviewableScenarioSlugs,
    activeBatch: activeBatch.number,
    activeRevisionKey: activeBatch.revisionKey,
    activeRevisionLabel: activeBatch.label,
    status: activeBatch.status,
    feedbackPath
  }
}

export function buildMemeReviewSources(
  ideaCollection: readonly ScenarioMemeIdeasV2[],
  assets: readonly MemeReviewAsset[]
): readonly MemeReviewSource[] {
  const cardsBySlug = new Map(
    contentCatalog.listScenarioCards().map((card) => [card.slug, card])
  )
  const ideasByScenarioSlug = new Map(
    ideaCollection.map((scenario) => [scenario.scenario_slug, scenario])
  )
  const assetsByScenarioSlug = Map.groupBy(
    assets,
    ({ scenario_slug }) => scenario_slug
  )
  const unknownScenarioSlugs = ideaCollection.flatMap(({ scenario_slug }) =>
    cardsBySlug.has(scenario_slug) ? [] : [scenario_slug]
  )
  const assetsForUnknownScenarios = [
    ...new Set(
      assets.flatMap(({ scenario_slug }) =>
        ideasByScenarioSlug.has(scenario_slug) ? [] : [scenario_slug]
      )
    )
  ]

  if (unknownScenarioSlugs.length || assetsForUnknownScenarios.length) {
    throw new Error(
      [
        unknownScenarioSlugs.length
          ? `Meme ideas for unknown scenarios: ${unknownScenarioSlugs.join(', ')}`
          : null,
        assetsForUnknownScenarios.length
          ? `Meme assets without active ideas: ${assetsForUnknownScenarios.join(', ')}`
          : null
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  const scenarios = ideaCollection
    .map(({ scenario_slug, ideas }): MemeReviewScenario => {
      const card = cardsBySlug.get(scenario_slug)
      const scenario = contentCatalog.getScenarioPage(scenario_slug)
      const scenarioAssets = assetsByScenarioSlug.get(scenario_slug)

      if (!card || !scenario || !scenarioAssets?.length) {
        throw new Error(`Missing meme review scenario: ${scenario_slug}`)
      }

      return {
        slug: scenario.slug,
        title: scenario.title,
        href: card.href,
        featured: card.featured,
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
        assets: scenarioAssets,
        ideas
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
