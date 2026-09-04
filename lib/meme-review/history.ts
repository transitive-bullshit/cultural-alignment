import type { MemeReviewSnapshot } from './rounds'
import type {
  MemeFeedbackEntry,
  MemeIdeaV1,
  MemeIdeaV2,
  MemeReviewAsset,
  ScenarioMemeIdeasV2
} from './schema'

export type MemeReviewImage = {
  readonly src: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly blurDataURL: string
  readonly objectPosition: string
}

export type MemeArchivedReviewImage = MemeReviewImage & {
  readonly contentHash: string
}

export type MemePreviewHistoryEntryV1 = {
  readonly renderer: 1
  readonly batch: number
  readonly revisionKey: string
  readonly label: string
  readonly idea: MemeIdeaV1
  readonly image: MemeArchivedReviewImage
  readonly feedback: MemeFeedbackEntry
}

export type MemePreviewHistoryEntryV2 = {
  readonly renderer: 2
  readonly batch: number
  readonly revisionKey: string
  readonly label: string
  readonly idea: MemeIdeaV2
  readonly assets: readonly MemeReviewAsset[]
  readonly feedback: MemeFeedbackEntry
}

export type MemePreviewHistoryEntry =
  | MemePreviewHistoryEntryV1
  | MemePreviewHistoryEntryV2

export interface MemePreviewHistory {
  readonly [ideaId: string]: readonly MemePreviewHistoryEntry[]
}

const emptyFeedback: MemeFeedbackEntry = {
  rating: null,
  notes: '',
  locked: false,
  lockRevision: 0
}

export function buildMemePreviewHistory({
  activeIdeas,
  historySnapshots
}: {
  readonly activeIdeas: readonly ScenarioMemeIdeasV2[]
  readonly historySnapshots: readonly MemeReviewSnapshot[]
}): MemePreviewHistory {
  const activeIdeaIds = new Set(
    activeIdeas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
  )
  const history: Record<string, MemePreviewHistoryEntry[]> = {}

  for (const batch of historySnapshots) {
    if (batch.renderer === 1) {
      const previewsByScenario = new Map(
        batch.previews.scenarios.map((preview) => [
          preview.scenario_slug,
          preview
        ])
      )

      for (const scenario of batch.ideas) {
        const preview = previewsByScenario.get(scenario.scenario_slug)
        if (!preview) {
          throw new Error(
            `Batch ${batch.number} history is missing an image for ${scenario.scenario_slug}`
          )
        }

        for (const idea of scenario.ideas) {
          if (!activeIdeaIds.has(idea.id)) continue

          const entries = history[idea.id] ?? []
          entries.push({
            renderer: 1,
            batch: batch.number,
            revisionKey: batch.revisionKey,
            label: batch.label,
            idea,
            image: {
              src: preview.src,
              alt: preview.alt,
              width: preview.width,
              height: preview.height,
              blurDataURL: preview.blur_data_url,
              objectPosition: preview.object_position,
              contentHash: preview.content_hash
            },
            feedback: batch.feedback.feedback[idea.id] ?? emptyFeedback
          })
          history[idea.id] = entries
        }
      }

      continue
    }

    const assetsByScenario = Map.groupBy(
      batch.assets,
      ({ scenario_slug }) => scenario_slug
    )

    for (const scenario of batch.ideas) {
      const assets = assetsByScenario.get(scenario.scenario_slug)
      if (!assets) {
        throw new Error(
          `Batch ${batch.number} history is missing assets for ${scenario.scenario_slug}`
        )
      }

      for (const idea of scenario.ideas) {
        if (!activeIdeaIds.has(idea.id)) continue
        if (batch.kind === 'draft' && !batch.feedback.feedback[idea.id])
          continue

        const entries = history[idea.id] ?? []
        entries.push({
          renderer: 2,
          batch: batch.number,
          revisionKey: batch.revisionKey,
          label: batch.label,
          idea,
          assets,
          feedback: batch.feedback.feedback[idea.id] ?? emptyFeedback
        })
        history[idea.id] = entries
      }
    }
  }

  return history
}
