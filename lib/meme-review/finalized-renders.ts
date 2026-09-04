import { memeRevisionFingerprint } from './fingerprint'
import type {
  MemeArchivedReviewImage,
  MemePreviewHistory,
  MemePreviewHistoryEntry
} from './history'
import type { MemeReviewSource } from './catalog'
import type {
  MemeFeedbackEntry,
  MemeIdeaV1,
  MemeIdeaV2,
  MemeReviewAsset
} from './schema'
import { stripTerminalMemePeriods } from '../../scripts/meme-review-round-utils'

type FinalizedMemeRenderTargetMetadata = {
  readonly ideaId: string
  readonly scenarioSlug: string
  readonly scenarioTitle: string
  readonly sourceSlug: string
  readonly sourceTitle: string
  readonly revisionKey: string
  readonly revisionLabel: string
  readonly payloadFingerprint: string
}

type UnnormalizedFinalizedMemeRenderTarget =
  | (FinalizedMemeRenderTargetMetadata & {
      readonly renderer: 1
      readonly idea: MemeIdeaV1
      readonly image: MemeArchivedReviewImage
    })
  | (FinalizedMemeRenderTargetMetadata & {
      readonly renderer: 2
      readonly idea: MemeIdeaV2
      readonly assets: readonly MemeReviewAsset[]
    })

type TerminalPeriodNormalization = {
  readonly renderedPayloadFingerprint: string
  readonly terminalPeriodNormalization: {
    readonly applied: boolean
    readonly changedLineIndexes: readonly number[]
  }
}

export type FinalizedMemeRenderTarget =
  | (FinalizedMemeRenderTargetMetadata &
      TerminalPeriodNormalization & {
        readonly renderer: 1
        readonly idea: MemeIdeaV1
        readonly image: MemeArchivedReviewImage
      })
  | (FinalizedMemeRenderTargetMetadata &
      TerminalPeriodNormalization & {
        readonly renderer: 2
        readonly idea: MemeIdeaV2
        readonly assets: readonly MemeReviewAsset[]
      })

export function resolveFinalizedMemeRenderTargets({
  sources,
  historyByIdeaId,
  feedback,
  activeRevisionKey,
  activeRevisionLabel
}: {
  readonly sources: readonly MemeReviewSource[]
  readonly historyByIdeaId: MemePreviewHistory
  readonly feedback: Readonly<Record<string, MemeFeedbackEntry>>
  readonly activeRevisionKey: string
  readonly activeRevisionLabel: string
}): readonly FinalizedMemeRenderTarget[] {
  const targets: FinalizedMemeRenderTarget[] = []
  const resolvedIdeaIds = new Set<string>()

  for (const source of sources) {
    for (const scenario of source.scenarios) {
      for (const activeIdea of scenario.ideas) {
        const ideaFeedback = feedback[activeIdea.id]
        if (!ideaFeedback?.locked) continue

        const revisionKey =
          ideaFeedback.finalizedVersion?.revisionKey ?? activeRevisionKey
        const selectedHistoryEntry =
          revisionKey === activeRevisionKey
            ? undefined
            : historyByIdeaId[activeIdea.id]?.find(
                (entry) => entry.revisionKey === revisionKey
              )

        if (revisionKey !== activeRevisionKey && !selectedHistoryEntry) {
          throw new Error(
            `Finalized meme ${activeIdea.id} references unavailable revision ${revisionKey}`
          )
        }

        const target = selectedHistoryEntry
          ? fromHistoryEntry({
              entry: selectedHistoryEntry,
              scenarioSlug: scenario.slug,
              scenarioTitle: scenario.title,
              sourceSlug: source.slug,
              sourceTitle: source.title
            })
          : fromActiveIdea({
              idea: activeIdea,
              assets: scenario.assets,
              revisionKey,
              revisionLabel: activeRevisionLabel,
              scenarioSlug: scenario.slug,
              scenarioTitle: scenario.title,
              sourceSlug: source.slug,
              sourceTitle: source.title
            })

        const expectedFingerprint =
          ideaFeedback.finalizedVersion?.payloadFingerprint
        if (
          expectedFingerprint &&
          expectedFingerprint !== target.payloadFingerprint
        ) {
          throw new Error(
            `Finalized meme ${activeIdea.id} payload no longer matches ${revisionKey}`
          )
        }

        targets.push(normalizeTerminalPeriods(target))
        resolvedIdeaIds.add(activeIdea.id)
      }
    }
  }

  const unresolvedLockedIdeas = Object.entries(feedback).flatMap(
    ([ideaId, entry]) =>
      entry.locked && !resolvedIdeaIds.has(ideaId) ? [ideaId] : []
  )
  if (unresolvedLockedIdeas.length) {
    throw new Error(
      `Finalized feedback references ideas outside the active catalog: ${unresolvedLockedIdeas.join(', ')}`
    )
  }

  return targets
}

function normalizeTerminalPeriods(
  target: UnnormalizedFinalizedMemeRenderTarget
): FinalizedMemeRenderTarget {
  const captionLines = stripTerminalMemePeriods(target.idea.caption_lines)
  const changedLineIndexes = captionLines.flatMap((line, index) =>
    line === target.idea.caption_lines[index] ? [] : [index]
  )

  if (target.renderer === 1) {
    const normalizedIdea: MemeIdeaV1 = {
      ...target.idea,
      caption_lines: captionLines
    }

    return {
      ...target,
      idea: normalizedIdea,
      renderedPayloadFingerprint: memeRevisionFingerprint({
        renderer: 1,
        idea: normalizedIdea,
        image: target.image
      }),
      terminalPeriodNormalization: {
        applied: changedLineIndexes.length > 0,
        changedLineIndexes
      }
    }
  }

  const normalizedIdea: MemeIdeaV2 = {
    ...target.idea,
    caption_lines: captionLines
  }

  return {
    ...target,
    idea: normalizedIdea,
    renderedPayloadFingerprint: memeRevisionFingerprint({
      renderer: 2,
      idea: normalizedIdea,
      assets: target.assets
    }),
    terminalPeriodNormalization: {
      applied: changedLineIndexes.length > 0,
      changedLineIndexes
    }
  }
}

function fromHistoryEntry({
  entry,
  scenarioSlug,
  scenarioTitle,
  sourceSlug,
  sourceTitle
}: {
  readonly entry: MemePreviewHistoryEntry
  readonly scenarioSlug: string
  readonly scenarioTitle: string
  readonly sourceSlug: string
  readonly sourceTitle: string
}): UnnormalizedFinalizedMemeRenderTarget {
  const common = {
    ideaId: entry.idea.id,
    scenarioSlug,
    scenarioTitle,
    sourceSlug,
    sourceTitle,
    revisionKey: entry.revisionKey,
    revisionLabel: entry.label
  }

  if (entry.renderer === 1) {
    const payloadFingerprint = memeRevisionFingerprint({
      renderer: 1,
      idea: entry.idea,
      image: entry.image
    })

    return {
      ...common,
      renderer: 1,
      idea: entry.idea,
      image: entry.image,
      payloadFingerprint
    }
  }

  const payloadFingerprint = memeRevisionFingerprint({
    renderer: 2,
    idea: entry.idea,
    assets: entry.assets
  })

  return {
    ...common,
    renderer: 2,
    idea: entry.idea,
    assets: entry.assets,
    payloadFingerprint
  }
}

function fromActiveIdea({
  idea,
  assets,
  revisionKey,
  revisionLabel,
  scenarioSlug,
  scenarioTitle,
  sourceSlug,
  sourceTitle
}: {
  readonly idea: MemeIdeaV2
  readonly assets: readonly MemeReviewAsset[]
  readonly revisionKey: string
  readonly revisionLabel: string
  readonly scenarioSlug: string
  readonly scenarioTitle: string
  readonly sourceSlug: string
  readonly sourceTitle: string
}): UnnormalizedFinalizedMemeRenderTarget {
  return {
    renderer: 2,
    idea,
    assets,
    ideaId: idea.id,
    scenarioSlug,
    scenarioTitle,
    sourceSlug,
    sourceTitle,
    revisionKey,
    revisionLabel,
    payloadFingerprint: memeRevisionFingerprint({ renderer: 2, idea, assets })
  }
}
