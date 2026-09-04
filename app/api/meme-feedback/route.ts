import { ZodError } from 'zod'

import {
  loadMemeReviewCatalog,
  type MemeReviewCatalog
} from '@/lib/meme-review/catalog'
import {
  memeRevisionFingerprint,
  type MemeFinalizationPayload
} from '@/lib/meme-review/fingerprint'
import { memeReviewBatchPatchSchema } from '@/lib/meme-review/schema'
import {
  FinalizedMemeMutationError,
  getMemeReviewStatePath,
  patchMemeReviewState,
  StaleMemeFinalizationError
} from '@/lib/meme-review/store'

export const runtime = 'nodejs'

class StaleMemePayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaleMemePayloadError'
  }
}

export async function PATCH(request: Request) {
  try {
    const patch = memeReviewBatchPatchSchema.parse(await request.json())
    const catalog = await loadMemeReviewCatalog()

    if (patch.round !== catalog.activeBatch) {
      return Response.json(
        {
          error: `Stale meme review batch: ${patch.round}; active batch is ${catalog.activeBatch}`
        },
        { status: 400, headers: noStoreHeaders }
      )
    }

    const unknownIdea = patch.ideaUpdates.find(
      ({ ideaId }) => !catalog.ideaIds.has(ideaId)
    )
    const unknownScenario = patch.scenarioUpdates.find(
      ({ scenarioSlug }) => !catalog.scenarioSlugs.has(scenarioSlug)
    )

    if (unknownIdea) {
      return Response.json(
        { error: `Unknown meme idea: ${unknownIdea.ideaId}` },
        { status: 400, headers: noStoreHeaders }
      )
    }

    if (unknownScenario) {
      return Response.json(
        { error: `Unknown review scenario: ${unknownScenario.scenarioSlug}` },
        { status: 400, headers: noStoreHeaders }
      )
    }

    const statePath = getMemeReviewStatePath(catalog.feedbackPath)
    if (statePath === catalog.feedbackPath) {
      const unavailableIdea = patch.ideaUpdates.find(
        ({ ideaId }) => !catalog.reviewableIdeaIds.has(ideaId)
      )
      const unavailableScenario = patch.scenarioUpdates.find(
        ({ scenarioSlug }) => !catalog.reviewableScenarioSlugs.has(scenarioSlug)
      )

      if (unavailableIdea || unavailableScenario) {
        return Response.json(
          {
            error: unavailableIdea
              ? `Meme idea ${unavailableIdea.ideaId} is still being generated or checked`
              : `Scenario ${unavailableScenario?.scenarioSlug} is still being generated or checked`
          },
          { status: 409, headers: noStoreHeaders }
        )
      }
    }

    const document = await patchMemeReviewState(patch, statePath, {
      beforeCommit: async () => {
        const currentCatalog = await loadMemeReviewCatalog()
        assertPatchStillTargetsActiveCatalog({
          patch,
          currentCatalog,
          statePath
        })

        for (const update of patch.ideaUpdates) {
          if (update.feedback.locked === undefined) continue

          const targetRevisionKey = update.targetRevisionKey
          const expectedPayloadFingerprint = update.expectedPayloadFingerprint
          if (
            targetRevisionKey === undefined ||
            expectedPayloadFingerprint === undefined
          ) {
            throw new StaleMemePayloadError(
              `Meme idea ${update.ideaId} has an incomplete finalization target`
            )
          }

          const finalizedVersion = update.expectedFeedback?.finalizedVersion
          if (
            update.feedback.locked === false &&
            finalizedVersion !== undefined &&
            (finalizedVersion.revisionKey !== targetRevisionKey ||
              finalizedVersion.payloadFingerprint !==
                expectedPayloadFingerprint)
          ) {
            throw new StaleMemePayloadError(
              `Meme idea ${update.ideaId} must be unfinalized from its currently selected revision`
            )
          }

          const payload = findRevisionPayload(
            currentCatalog,
            update.ideaId,
            targetRevisionKey
          )
          if (!payload) {
            throw new StaleMemePayloadError(
              `Meme idea ${update.ideaId} no longer has revision ${targetRevisionKey}`
            )
          }

          const actualFingerprint = memeRevisionFingerprint(payload)
          if (actualFingerprint !== expectedPayloadFingerprint) {
            throw new StaleMemePayloadError(
              `Meme idea ${update.ideaId} changed since it was displayed; reload before changing finalization`
            )
          }
        }
      }
    })

    return Response.json(
      {
        round: document.round,
        ideaIds: patch.ideaUpdates.map(({ ideaId }) => ideaId),
        feedback: Object.fromEntries(
          patch.ideaUpdates.flatMap(({ ideaId }) => {
            const entry = document.feedback[ideaId]
            return entry ? [[ideaId, entry]] : []
          })
        ),
        scenarioSlugs: patch.scenarioUpdates.map(
          ({ scenarioSlug }) => scenarioSlug
        ),
        updatedAt: document.updatedAt
      },
      { headers: noStoreHeaders }
    )
  } catch (err) {
    if (
      err instanceof FinalizedMemeMutationError ||
      err instanceof StaleMemeFinalizationError ||
      err instanceof StaleMemePayloadError
    ) {
      return Response.json(
        { error: err.message },
        { status: 409, headers: noStoreHeaders }
      )
    }

    if (err instanceof ZodError || err instanceof SyntaxError) {
      return Response.json(
        { error: 'Invalid meme feedback payload' },
        { status: 400, headers: noStoreHeaders }
      )
    }

    console.error('Failed to save meme feedback', err)
    return Response.json(
      { error: 'Could not save meme feedback' },
      { status: 500, headers: noStoreHeaders }
    )
  }
}

const noStoreHeaders = {
  'Cache-Control': 'no-store'
}

function assertPatchStillTargetsActiveCatalog({
  patch,
  currentCatalog,
  statePath
}: {
  readonly patch: ReturnType<typeof memeReviewBatchPatchSchema.parse>
  readonly currentCatalog: MemeReviewCatalog
  readonly statePath: string
}) {
  const currentStatePath = getMemeReviewStatePath(currentCatalog.feedbackPath)
  if (
    currentCatalog.activeBatch !== patch.round ||
    currentStatePath !== statePath
  ) {
    throw new StaleMemePayloadError(
      `Meme review batch changed from ${patch.round} to ${currentCatalog.activeBatch}; reload before saving feedback`
    )
  }

  const unknownIdea = patch.ideaUpdates.find(
    ({ ideaId }) => !currentCatalog.ideaIds.has(ideaId)
  )
  if (unknownIdea) {
    throw new StaleMemePayloadError(
      `Meme idea ${unknownIdea.ideaId} is no longer active; reload before saving feedback`
    )
  }

  const unknownScenario = patch.scenarioUpdates.find(
    ({ scenarioSlug }) => !currentCatalog.scenarioSlugs.has(scenarioSlug)
  )
  if (unknownScenario) {
    throw new StaleMemePayloadError(
      `Scenario ${unknownScenario.scenarioSlug} is no longer active; reload before saving feedback`
    )
  }

  if (statePath !== currentCatalog.feedbackPath) return

  const unavailableIdea = patch.ideaUpdates.find(
    ({ ideaId }) => !currentCatalog.reviewableIdeaIds.has(ideaId)
  )
  if (unavailableIdea) {
    throw new StaleMemePayloadError(
      `Meme idea ${unavailableIdea.ideaId} is no longer available for review; reload before saving feedback`
    )
  }

  const unavailableScenario = patch.scenarioUpdates.find(
    ({ scenarioSlug }) =>
      !currentCatalog.reviewableScenarioSlugs.has(scenarioSlug)
  )
  if (unavailableScenario) {
    throw new StaleMemePayloadError(
      `Scenario ${unavailableScenario.scenarioSlug} is no longer available for review; reload before saving feedback`
    )
  }
}

function findRevisionPayload(
  catalog: MemeReviewCatalog,
  ideaId: string,
  revisionKey: string
): MemeFinalizationPayload | null {
  if (revisionKey === catalog.activeRevisionKey) {
    for (const source of catalog.sources) {
      for (const scenario of source.scenarios) {
        const idea = scenario.ideas.find(({ id }) => id === ideaId)
        if (idea) return { renderer: 2, idea, assets: scenario.assets }
      }
    }

    return null
  }

  const entry = catalog.historyByIdeaId[ideaId]?.find(
    (candidate) => candidate.revisionKey === revisionKey
  )
  if (!entry) return null

  return entry.renderer === 1
    ? { renderer: 1, idea: entry.idea, image: entry.image }
    : { renderer: 2, idea: entry.idea, assets: entry.assets }
}
