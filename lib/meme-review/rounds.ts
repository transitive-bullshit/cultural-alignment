import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { assertFinalizedMemesPreserved } from './finalization'
import {
  memeFeedbackDocumentV1Schema,
  memeIdeaCollectionV1Schema,
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewBatchStatusSchema,
  memeReviewScenarioPreviewDocumentV1Schema,
  memeReviewStateDocumentSchema,
  type MemeFeedbackDocumentV1,
  type MemeReviewAsset,
  type MemeReviewBatchStatus,
  type MemeReviewScenarioPreviewDocumentV1,
  type MemeReviewStateDocument,
  type ScenarioMemeIdeasV1,
  type ScenarioMemeIdeasV2
} from './schema'

const roundDirectoryPattern = /^round-(\d+)$/

export type MemeReviewBatchV1 = {
  readonly kind: 'batch'
  readonly renderer: 1
  readonly number: number
  readonly name: string
  readonly revisionKey: string
  readonly label: string
  readonly path: string
  readonly ideas: readonly ScenarioMemeIdeasV1[]
  readonly feedback: MemeFeedbackDocumentV1
  readonly previews: MemeReviewScenarioPreviewDocumentV1
}

export type MemeReviewBatchV2 = {
  readonly kind: 'batch'
  readonly renderer: 2
  readonly number: number
  readonly name: string
  readonly revisionKey: string
  readonly label: string
  readonly path: string
  readonly ideas: readonly ScenarioMemeIdeasV2[]
  readonly feedback: MemeReviewStateDocument
  readonly assets: readonly MemeReviewAsset[]
  readonly status: MemeReviewBatchStatus
}

export type MemeReviewBatch = MemeReviewBatchV1 | MemeReviewBatchV2

export type MemeReviewDraftV2 = Omit<MemeReviewBatchV2, 'kind' | 'status'> & {
  readonly kind: 'draft'
}

export type MemeReviewSnapshot = MemeReviewBatch | MemeReviewDraftV2

export type MemeReviewWorkspace = {
  readonly batches: readonly MemeReviewBatch[]
  readonly activeBatch: MemeReviewBatchV2
  readonly archivedBatches: readonly MemeReviewBatch[]
  readonly historySnapshots: readonly MemeReviewSnapshot[]
  readonly feedbackPath: string
}

export function getMemeReviewRoundsPath() {
  return join(process.cwd(), 'data', 'meme-review', 'rounds')
}

export async function loadMemeReviewWorkspace(
  roundsPath = getMemeReviewRoundsPath()
): Promise<MemeReviewWorkspace> {
  const entries = await readdir(roundsPath, { withFileTypes: true })
  const descriptors = entries
    .flatMap((entry) => {
      const match = entry.isDirectory()
        ? roundDirectoryPattern.exec(entry.name)
        : null
      if (!match) return []

      return [
        {
          number: Number(match[1]),
          name: entry.name,
          path: join(roundsPath, entry.name)
        }
      ]
    })
    .toSorted((left, right) => left.number - right.number)

  if (descriptors.length === 0) {
    throw new Error(`No meme review batches found in ${roundsPath}`)
  }

  const batches: MemeReviewBatch[] = []
  let activeBatch: MemeReviewBatchV2 | undefined
  let rendererV2ChainBroken = false

  for (const descriptor of descriptors) {
    const isRendererV2 = descriptor.number > 1

    if (isRendererV2 && rendererV2ChainBroken) continue

    let batch: MemeReviewBatch
    try {
      batch = await loadMemeReviewBatch(descriptor)
    } catch (err) {
      reportSkippedBatch(descriptor.name, err)
      if (isRendererV2) rendererV2ChainBroken = true
      continue
    }

    if (batch.renderer === 2 && activeBatch) {
      try {
        assertFinalizedMemesPreserved(
          finalizationSnapshot(activeBatch),
          finalizationSnapshot(batch)
        )
      } catch (err) {
        reportSkippedBatch(descriptor.name, err)
        rendererV2ChainBroken = true
        continue
      }
    }

    batches.push(batch)
    if (batch.renderer === 2) activeBatch = batch
  }

  if (!activeBatch) {
    throw new Error('The meme review workspace has no renderer-v2 active batch')
  }

  const drafts = (
    await Promise.all(
      batches
        .filter((batch): batch is MemeReviewBatchV2 => batch.renderer === 2)
        .map(loadMemeReviewDrafts)
    )
  ).flat()
  const archivedBatches = batches.filter(
    ({ number }) => number !== activeBatch.number
  )

  return {
    batches,
    activeBatch,
    archivedBatches,
    historySnapshots: [...archivedBatches, ...drafts].toSorted(
      (left, right) =>
        left.number - right.number ||
        compareNullableTimestamps(
          left.feedback.updatedAt,
          right.feedback.updatedAt
        ) ||
        (left.kind === right.kind ? 0 : left.kind === 'draft' ? -1 : 1) ||
        left.revisionKey.localeCompare(right.revisionKey)
    ),
    feedbackPath: join(activeBatch.path, 'feedback.json')
  }
}

function finalizationSnapshot(batch: MemeReviewBatchV2) {
  return {
    ideas: batch.ideas,
    assets: batch.assets,
    feedback: batch.feedback.feedback
  }
}

function reportSkippedBatch(batchName: string, error: unknown) {
  console.error(
    `[meme-review] Skipping invalid ${batchName}; retaining the last valid renderer-v2 batch`,
    error
  )
}

async function loadMemeReviewBatch({
  number,
  name,
  path
}: {
  readonly number: number
  readonly name: string
  readonly path: string
}): Promise<MemeReviewBatch> {
  const rawIdeas = await readJson(join(path, 'ideas.json'))
  const rawFeedback = await readJson(join(path, 'feedback.json'))

  if (number === 1) {
    const ideas = memeIdeaCollectionV1Schema.parse(rawIdeas)
    const feedback = memeFeedbackDocumentV1Schema.parse(rawFeedback)
    const previews = memeReviewScenarioPreviewDocumentV1Schema.parse(
      await readJson(join(path, 'scenario-previews.json'))
    )

    validateFeedbackReferences(ideas, feedback.feedback, name)
    validateLegacyPreviews(ideas, previews, name)

    return {
      kind: 'batch',
      renderer: 1,
      number,
      name,
      revisionKey: name,
      label: `Batch ${number}`,
      path,
      ideas,
      feedback,
      previews
    }
  }

  const ideas = memeIdeaCollectionV2Schema.parse(rawIdeas)
  const feedback = memeReviewStateDocumentSchema.parse(rawFeedback)
  const assets = memeReviewAssetCollectionSchema.parse(
    await readJson(join(path, 'assets.json'))
  )
  const status = memeReviewBatchStatusSchema.parse(
    await readJson(join(path, 'status.json'))
  )

  if (feedback.round !== number) {
    throw new Error(
      `${name}/feedback.json identifies batch ${feedback.round}, expected ${number}`
    )
  }
  if (status.batch !== number) {
    throw new Error(
      `${name}/status.json identifies batch ${status.batch}, expected ${number}`
    )
  }

  validateFeedbackReferences(ideas, feedback.feedback, name)
  validateAssetReferences(ideas, assets, name)

  return {
    kind: 'batch',
    renderer: 2,
    number,
    name,
    revisionKey: name,
    label: `Batch ${number}`,
    path,
    ideas,
    feedback,
    assets,
    status
  }
}

async function loadMemeReviewDrafts(
  batch: MemeReviewBatchV2
): Promise<readonly MemeReviewDraftV2[]> {
  const draftsPath = join(batch.path, 'drafts')
  let entries

  try {
    entries = await readdir(draftsPath, { withFileTypes: true })
  } catch (err) {
    if (isMissingFileError(err)) return []
    throw err
  }

  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map(async (entry): Promise<MemeReviewDraftV2> => {
        const path = join(draftsPath, entry.name)
        const ideas = memeIdeaCollectionV2Schema.parse(
          await readJson(join(path, 'ideas.json'))
        )
        const feedback = memeReviewStateDocumentSchema.parse(
          await readJson(join(path, 'feedback.json'))
        )
        const assets = memeReviewAssetCollectionSchema.parse(
          await readJson(join(path, 'assets.json'))
        )

        if (feedback.round !== batch.number) {
          throw new Error(
            `${batch.name}/drafts/${entry.name} identifies batch ${feedback.round}, expected ${batch.number}`
          )
        }

        validateFeedbackReferences(
          ideas,
          feedback.feedback,
          `${batch.name}/drafts/${entry.name}`
        )
        validateAssetReferences(
          ideas,
          assets,
          `${batch.name}/drafts/${entry.name}`
        )

        return {
          kind: 'draft',
          renderer: 2,
          number: batch.number,
          name: entry.name,
          revisionKey: `${batch.name}/drafts/${entry.name}`,
          label: `Batch ${batch.number} · ${draftLabel(entry.name)}`,
          path,
          ideas,
          feedback,
          assets
        }
      })
  )
}

function validateFeedbackReferences(
  ideas: readonly (ScenarioMemeIdeasV1 | ScenarioMemeIdeasV2)[],
  feedback: Readonly<Record<string, unknown>>,
  batchName: string
) {
  const ideaIds = new Set(
    ideas.flatMap((scenario) => scenario.ideas.map(({ id }) => id))
  )

  for (const ideaId of Object.keys(feedback)) {
    if (!ideaIds.has(ideaId)) {
      throw new Error(
        `${batchName} feedback references unknown idea: ${ideaId}`
      )
    }
  }
}

function validateLegacyPreviews(
  ideas: readonly ScenarioMemeIdeasV1[],
  previews: MemeReviewScenarioPreviewDocumentV1,
  batchName: string
) {
  const ideaScenarioSlugs = new Set(
    ideas.map(({ scenario_slug }) => scenario_slug)
  )
  const previewScenarioSlugs = new Set(
    previews.scenarios.map(({ scenario_slug }) => scenario_slug)
  )
  const missing = [...ideaScenarioSlugs].filter(
    (scenarioSlug) => !previewScenarioSlugs.has(scenarioSlug)
  )
  const unexpected = [...previewScenarioSlugs].filter(
    (scenarioSlug) => !ideaScenarioSlugs.has(scenarioSlug)
  )

  if (missing.length || unexpected.length) {
    throw new Error(
      `${batchName} preview mismatch; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
    )
  }
}

function validateAssetReferences(
  ideas: readonly ScenarioMemeIdeasV2[],
  assets: readonly MemeReviewAsset[],
  batchName: string
) {
  const scenarioSlugs = new Set(ideas.map(({ scenario_slug }) => scenario_slug))
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))

  for (const asset of assets) {
    if (!scenarioSlugs.has(asset.scenario_slug)) {
      throw new Error(
        `${batchName} asset references unknown scenario: ${asset.id}`
      )
    }
    if (!asset.id.startsWith(`${asset.scenario_slug}--`)) {
      throw new Error(
        `${batchName} asset id must begin with its scenario slug: ${asset.id}`
      )
    }
  }

  for (const scenario of ideas) {
    for (const idea of scenario.ideas) {
      for (const assetId of idea.preview.asset_ids) {
        const asset = assetsById.get(assetId)
        if (!asset) {
          throw new Error(
            `${batchName} idea references unknown asset: ${idea.id} -> ${assetId}`
          )
        }
        if (asset.scenario_slug !== scenario.scenario_slug) {
          throw new Error(
            `${batchName} idea references another scenario's asset: ${idea.id} -> ${assetId}`
          )
        }
      }
    }
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

function draftLabel(name: string): string {
  return name
    .replace(/-\d{4}-\d{2}-\d{2}.*$/, '')
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function compareNullableTimestamps(left: string | null, right: string | null) {
  return (left ?? '').localeCompare(right ?? '')
}
