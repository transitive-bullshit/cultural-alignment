import { isDeepStrictEqual } from 'node:util'

import type {
  MemeFeedbackEntry,
  MemeReviewAsset,
  ScenarioMemeIdeasV2
} from './schema'

export interface MemeFinalizationSnapshot {
  readonly ideas: readonly ScenarioMemeIdeasV2[]
  readonly assets: readonly MemeReviewAsset[]
  readonly feedback: Readonly<Record<string, MemeFeedbackEntry>>
}

/**
 * Refuses a generation or publication pass that changes anything already
 * finalized in its source snapshot. A later snapshot may explicitly unlock
 * an item, but that transition cannot also revise the idea or its assets.
 * Feedback may then evolve while the idea remains unlocked.
 */
export function assertFinalizedMemesPreserved(
  source: MemeFinalizationSnapshot,
  target: MemeFinalizationSnapshot
) {
  const sourceIdeasById = indexIdeas(source.ideas)
  const targetIdeasById = indexIdeas(target.ideas)
  const sourceAssetsById = new Map(
    source.assets.map((asset) => [asset.id, asset])
  )
  const targetAssetsById = new Map(
    target.assets.map((asset) => [asset.id, asset])
  )

  for (const [ideaId, sourceFeedback] of Object.entries(source.feedback)) {
    if (!sourceFeedback.locked) continue

    const sourceMatch = sourceIdeasById.get(ideaId)
    if (!sourceMatch) {
      throw preservationError(ideaId, 'is missing from the source idea set')
    }

    const targetMatch = targetIdeasById.get(ideaId)
    if (!targetMatch) {
      throw preservationError(ideaId, 'was removed from the target idea set')
    }
    if (targetMatch.scenarioSlug !== sourceMatch.scenarioSlug) {
      throw preservationError(
        ideaId,
        `moved from scenario ${sourceMatch.scenarioSlug} to ${targetMatch.scenarioSlug}`
      )
    }
    if (!isDeepStrictEqual(targetMatch.idea, sourceMatch.idea)) {
      throw preservationError(ideaId, 'changed its finalized idea payload')
    }

    for (const assetId of sourceMatch.idea.preview.asset_ids) {
      const sourceAsset = sourceAssetsById.get(assetId)
      if (!sourceAsset) {
        throw preservationError(
          ideaId,
          `references source asset ${assetId}, but that asset is missing`
        )
      }

      const targetAsset = targetAssetsById.get(assetId)
      if (!targetAsset) {
        throw preservationError(ideaId, `lost referenced asset ${assetId}`)
      }
      if (!isDeepStrictEqual(targetAsset, sourceAsset)) {
        throw preservationError(ideaId, `changed referenced asset ${assetId}`)
      }
    }

    const targetFeedback = target.feedback[ideaId]
    if (!targetFeedback) {
      throw preservationError(ideaId, 'lost its finalized feedback snapshot')
    }
    if (targetFeedback.lockRevision < sourceFeedback.lockRevision) {
      throw preservationError(
        ideaId,
        'moved backward to an older finalization revision'
      )
    }

    if (
      targetFeedback.lockRevision === sourceFeedback.lockRevision &&
      !isDeepStrictEqual(targetFeedback, sourceFeedback)
    ) {
      throw preservationError(ideaId, 'changed its finalized feedback snapshot')
    }
  }
}

function indexIdeas(scenarios: readonly ScenarioMemeIdeasV2[]) {
  return new Map(
    scenarios.flatMap(({ scenario_slug, ideas }) =>
      ideas.map(
        (idea) => [idea.id, { scenarioSlug: scenario_slug, idea }] as const
      )
    )
  )
}

function preservationError(ideaId: string, detail: string) {
  return new Error(`Finalized meme ${ideaId} ${detail}`)
}
