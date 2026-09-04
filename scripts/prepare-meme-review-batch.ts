import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { withMemeReviewFileLock } from '../lib/meme-review/file-lock'
import { assertFinalizedMemesPreserved } from '../lib/meme-review/finalization'
import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewBatchStatusSchema,
  memeReviewStateDocumentSchema,
  type MemeFeedbackEntry,
  type MemeIdeaV2,
  type MemeReviewAsset,
  type MemeReviewBatchStatus,
  type MemeReviewStateDocument,
  type ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import {
  memeReviewIdeaEditorialHash,
  memeReviewIdeaHash,
  memeReviewRoundsPath,
  partition,
  sha256,
  stripTerminalMemePeriods,
  writeJsonExclusiveOrVerify
} from './meme-review-round-utils'

const scenariosPerPart = 12
const layoutRefinementMode = 'layout-refinement' as const
const punctuationRefinementMode = 'punctuation-refinement' as const

export type MemeReviewPreparationMode =
  | typeof layoutRefinementMode
  | typeof punctuationRefinementMode
export type MemeReviewGenerationAction =
  | 'finalized'
  | 'disabled-unchanged'
  | 'layout-only'
  | 'bounded-revision'
  | 'punctuation-only'
export type MemeReviewMutableField =
  | 'caption_lines'
  | 'preview'
  | 'frame_guidance'
  | 'why_it_works'
  | 'critic'
  | 'assets'

export type MemeReviewSourceFileName =
  | 'ideas.json'
  | 'assets.json'
  | 'feedback.json'
  | 'status.json'

export type MemeReviewSourceFileDigest = {
  readonly bytes: number
  readonly sha256: string
}

export type MemeReviewGenerationPlanIdea = {
  readonly id: string
  readonly scenario_slug: string
  readonly action: MemeReviewGenerationAction
  readonly source_idea_sha256: string
  readonly source_editorial_sha256: string
  readonly allowed_changed_fields: readonly MemeReviewMutableField[]
  readonly source_feedback: MemeFeedbackEntry | null
}

export type MemeReviewDroppedPlanIdea = Omit<
  MemeReviewGenerationPlanIdea,
  'action' | 'allowed_changed_fields'
>

export type MemeReviewGenerationPlan = {
  readonly version: 1
  readonly mode: MemeReviewPreparationMode
  readonly source_batch: number
  readonly target_batch: number
  readonly created_at: string
  readonly source_files: Readonly<
    Record<MemeReviewSourceFileName, MemeReviewSourceFileDigest>
  >
  readonly counts: {
    readonly source_scenarios: number
    readonly source_ideas: number
    readonly target_scenarios: number
    readonly target_ideas: number
    readonly mutable_scenarios: number
    readonly mutable_ideas: number
    readonly finalized_ideas: number
    readonly disabled_scenarios: number
    readonly dropped_scenarios: number
    readonly dropped_ideas: number
  }
  readonly ideas: readonly MemeReviewGenerationPlanIdea[]
  readonly dropped_ideas: readonly MemeReviewDroppedPlanIdea[]
  readonly asset_revision_idea_ids: readonly string[]
  readonly layout_policy: {
    readonly minimum_traditional_template_ratio: number
    readonly minimum_cover_frame_ratio: number
    readonly minimum_hero_or_standard_zone_ratio: number
    readonly maximum_external_layout_ratio: number
    readonly external_layout_exception_ids: readonly string[]
    readonly non_cover_exception_ids: readonly string[]
    readonly compact_text_exception_ids: readonly string[]
  }
  readonly parts: readonly {
    readonly part: string
    readonly scenario_slugs: readonly string[]
    readonly idea_ids: readonly string[]
  }[]
}

export type MemeReviewPreparationSourceBatch = {
  readonly number: number
  readonly ideas: readonly ScenarioMemeIdeasV2[]
  readonly assets: readonly MemeReviewAsset[]
  readonly feedback: MemeReviewStateDocument
  readonly status: MemeReviewBatchStatus
  readonly files: Readonly<
    Record<MemeReviewSourceFileName, MemeReviewSourceFileDigest>
  >
}

export type PreparedMemeReviewBatch = {
  readonly ideas: readonly ScenarioMemeIdeasV2[]
  readonly assets: readonly MemeReviewAsset[]
  readonly feedback: MemeReviewStateDocument
  readonly status: MemeReviewBatchStatus
  readonly generationPlan: MemeReviewGenerationPlan
  readonly parts: readonly {
    readonly name: string
    readonly ideas: readonly ScenarioMemeIdeasV2[]
    readonly assets: readonly (MemeReviewAsset & {
      readonly annotation_status: 'complete'
    })[]
    readonly brief: {
      readonly version: 1
      readonly mode: MemeReviewPreparationMode
      readonly source_batch: number
      readonly target_batch: number
      readonly part: string
      readonly instructions: {
        readonly scope: string
        readonly finalized: string
        readonly layout_only: string
        readonly bounded_revision: string
        readonly punctuation_only: string
      }
      readonly scenarios: readonly {
        readonly scenario_slug: string
        readonly ideas: readonly MemeReviewGenerationPlanIdea[]
      }[]
    }
  }[]
}

export type PrepareMemeReviewBatchOptions = {
  readonly source: string
  readonly target: string
  readonly mode: MemeReviewPreparationMode
  readonly roundsPath?: string
  readonly now?: Date
}

export async function prepareMemeReviewBatch({
  source,
  target,
  mode,
  roundsPath = memeReviewRoundsPath,
  now = new Date()
}: PrepareMemeReviewBatchOptions) {
  const sourceBatch = parseRoundName(source, 'source')
  const targetBatch = parseRoundName(target, 'target')
  if (targetBatch !== sourceBatch + 1) {
    throw new Error(`Target ${target} must immediately follow source ${source}`)
  }
  if (sourceBatch < 2) {
    throw new Error(
      'The generic batch initializer requires a renderer-v2 source'
    )
  }
  if (![layoutRefinementMode, punctuationRefinementMode].includes(mode)) {
    throw new Error(`Unsupported meme review preparation mode: ${String(mode)}`)
  }

  const sourcePath = join(roundsPath, source)
  const targetPath = join(roundsPath, target)
  const sourceFeedbackPath = join(sourcePath, 'feedback.json')

  if (!(await pathExists(sourceFeedbackPath))) {
    throw new Error(`Source meme review batch does not exist: ${source}`)
  }

  return withMemeReviewFileLock(sourceFeedbackPath, async () => {
    if (await pathExists(targetPath)) {
      throw new Error(
        `Refusing to overwrite existing meme review batch ${target}`
      )
    }

    const sourceData = await readSourceBatch(sourcePath, sourceBatch)
    const prepared = planMemeReviewBatch({
      source: sourceData,
      targetBatch,
      createdAt: now.toISOString(),
      mode
    })
    const stagingPath = join(
      roundsPath,
      `.${target}.staging-${process.pid}-${randomUUID()}`
    )

    await mkdir(stagingPath)

    try {
      await writePreparedBatch(stagingPath, prepared)
      await validateStagedBatch(stagingPath, prepared, targetBatch)
      await rename(stagingPath, targetPath)
    } catch (err) {
      await rm(stagingPath, { recursive: true, force: true })
      throw err
    }

    return {
      sourceBatch,
      targetBatch,
      targetPath,
      ...prepared.generationPlan.counts,
      immediateReviewableScenarios: prepared.status.reviewable_scenarios.length,
      parts: prepared.parts.map(({ name }) => name)
    }
  })
}

export function planLayoutRefinementBatch({
  source,
  targetBatch,
  createdAt
}: {
  readonly source: MemeReviewPreparationSourceBatch
  readonly targetBatch: number
  readonly createdAt: string
}): PreparedMemeReviewBatch {
  return planMemeReviewBatch({
    source,
    targetBatch,
    createdAt,
    mode: layoutRefinementMode
  })
}

export function planPunctuationRefinementBatch({
  source,
  targetBatch,
  createdAt
}: {
  readonly source: MemeReviewPreparationSourceBatch
  readonly targetBatch: number
  readonly createdAt: string
}): PreparedMemeReviewBatch {
  return planMemeReviewBatch({
    source,
    targetBatch,
    createdAt,
    mode: punctuationRefinementMode
  })
}

function planMemeReviewBatch({
  source,
  targetBatch,
  createdAt,
  mode
}: {
  readonly source: MemeReviewPreparationSourceBatch
  readonly targetBatch: number
  readonly createdAt: string
  readonly mode: MemeReviewPreparationMode
}): PreparedMemeReviewBatch {
  if (targetBatch !== source.number + 1) {
    throw new Error(
      `Target Batch ${targetBatch} must immediately follow source Batch ${source.number}`
    )
  }
  validateSourceBatch(source)

  const targetIdeas: ScenarioMemeIdeasV2[] = []
  const retainedPlanIdeas: MemeReviewGenerationPlanIdea[] = []
  const droppedPlanIdeas: MemeReviewDroppedPlanIdea[] = []
  const mutableScenarioSlugs = new Set<string>()
  const immediateReviewableSlugs: string[] = []

  for (const scenario of source.ideas) {
    const disabled = source.feedback.scenarios[scenario.scenario_slug]?.disabled
    const retainedIdeas: MemeIdeaV2[] = []
    let mutableIdeas = 0

    for (const idea of scenario.ideas) {
      const feedback = source.feedback.feedback[idea.id]
      const action = actionForIdea({
        feedback,
        disabled: disabled === true,
        mode
      })

      if (!action) {
        droppedPlanIdeas.push(
          droppedPlanIdea(scenario.scenario_slug, idea, feedback)
        )
        continue
      }

      retainedIdeas.push(idea)
      retainedPlanIdeas.push(
        planIdea(scenario.scenario_slug, idea, feedback, action)
      )
      if (isMutableAction(action)) mutableIdeas += 1
    }

    if (retainedIdeas.length === 0) continue

    targetIdeas.push({
      scenario_slug: scenario.scenario_slug,
      ideas: retainedIdeas
    })

    if (disabled || mutableIdeas === 0) {
      immediateReviewableSlugs.push(scenario.scenario_slug)
    } else {
      mutableScenarioSlugs.add(scenario.scenario_slug)
    }
  }

  const retainedScenarioSlugs = new Set(
    targetIdeas.map(({ scenario_slug }) => scenario_slug)
  )
  const targetAssets = source.assets.filter(({ scenario_slug }) =>
    retainedScenarioSlugs.has(scenario_slug)
  )
  const targetFeedbackEntries = Object.fromEntries(
    retainedPlanIdeas.flatMap(({ id, action, source_feedback }) =>
      action === 'finalized' && source_feedback
        ? [[id, source_feedback] as const]
        : []
    )
  )
  const targetFeedback = memeReviewStateDocumentSchema.parse({
    version: 2,
    round: targetBatch,
    updatedAt: null,
    feedback: targetFeedbackEntries,
    scenarios: source.feedback.scenarios
  })
  const workScenarios = targetIdeas.filter(({ scenario_slug }) =>
    mutableScenarioSlugs.has(scenario_slug)
  )
  const planIdeasByScenario = Map.groupBy(
    retainedPlanIdeas,
    ({ scenario_slug }) => scenario_slug
  )
  const actionsById = new Map(
    retainedPlanIdeas.map(({ id, action }) => [id, action])
  )
  const preparedParts = partition(workScenarios, scenariosPerPart).map(
    (ideas, index) => {
      const name = `part-${String(index + 1).padStart(2, '0')}`
      const scenarioSlugs = new Set(
        ideas.map(({ scenario_slug }) => scenario_slug)
      )
      const assets = targetAssets
        .filter(({ scenario_slug }) => scenarioSlugs.has(scenario_slug))
        .map((asset) => ({ ...asset, annotation_status: 'complete' as const }))
      const partIdeas =
        mode === punctuationRefinementMode
          ? ideas.map((scenario) => ({
              ...scenario,
              ideas: scenario.ideas.map((idea) => {
                const action = actionsById.get(idea.id)
                return action === 'punctuation-only' ||
                  action === 'bounded-revision'
                  ? {
                      ...idea,
                      caption_lines: stripTerminalMemePeriods(
                        idea.caption_lines
                      )
                    }
                  : idea
              })
            }))
          : ideas

      return {
        name,
        ideas: partIdeas,
        assets,
        brief: {
          version: 1 as const,
          mode,
          source_batch: source.number,
          target_batch: targetBatch,
          part: name,
          instructions: {
            scope:
              'Do not add meme ideas, IDs, concepts, formats, or source anchors. Work only on the retained lineages listed here.',
            finalized:
              'Copy finalized ideas and every referenced asset byte-for-byte. They are context only and must not be edited.',
            layout_only:
              'Keep approved caption copy and editorial fields exact. This is a typography refinement pass: try hero-sized conventional copy first, compare with the lineage’s earliest strong version when useful, and use standard only for a demonstrated wrap or focal collision. Add a subtle edge gradient when large overlay text needs contrast.',
            bounded_revision:
              mode === punctuationRefinementMode
                ? 'Remove every formal terminal period from caption lines, then apply only the additional work explicitly requested in the source note. Keep the concept, lineage, and every unrelated field exact.'
                : 'Apply only the explicit source feedback, including exact requested word changes. Keep the central concept, format, source anchor, and lineage ID unchanged. Otherwise follow the same hero-first typography and subtle-gradient guidance as layout-only ideas.',
            punctuation_only:
              mode === punctuationRefinementMode
                ? 'Change caption_lines only by removing one formal terminal period from each line, including a period immediately before closing quotes or brackets. Preserve ellipses, decimals, internal dots, and all other copy and fields exactly.'
                : 'Not used in this layout-refinement batch.'
          },
          scenarios: ideas.map(({ scenario_slug }) => ({
            scenario_slug,
            ideas: planIdeasByScenario.get(scenario_slug) ?? []
          }))
        }
      }
    }
  )
  const parts = preparedParts.map(({ name, ideas }) => ({
    part: name,
    scenario_slugs: ideas.map(({ scenario_slug }) => scenario_slug),
    idea_ids: ideas.flatMap(({ ideas: scenarioIdeas }) =>
      scenarioIdeas.map(({ id }) => id)
    )
  }))
  const mutableIdeas = retainedPlanIdeas.filter(({ action }) =>
    isMutableAction(action)
  ).length
  const finalizedIdeas = retainedPlanIdeas.filter(
    ({ action }) => action === 'finalized'
  ).length
  const disabledScenarios = targetIdeas.filter(
    ({ scenario_slug }) =>
      source.feedback.scenarios[scenario_slug]?.disabled === true
  ).length
  const generationPlan: MemeReviewGenerationPlan = {
    version: 1,
    mode,
    source_batch: source.number,
    target_batch: targetBatch,
    created_at: createdAt,
    source_files: source.files,
    counts: {
      source_scenarios: source.ideas.length,
      source_ideas: countIdeas(source.ideas),
      target_scenarios: targetIdeas.length,
      target_ideas: countIdeas(targetIdeas),
      mutable_scenarios: mutableScenarioSlugs.size,
      mutable_ideas: mutableIdeas,
      finalized_ideas: finalizedIdeas,
      disabled_scenarios: disabledScenarios,
      dropped_scenarios: source.ideas.length - targetIdeas.length,
      dropped_ideas: droppedPlanIdeas.length
    },
    ideas: retainedPlanIdeas,
    dropped_ideas: droppedPlanIdeas,
    asset_revision_idea_ids: retainedPlanIdeas.flatMap(
      ({ id, allowed_changed_fields }) =>
        allowed_changed_fields.includes('assets') ? [id] : []
    ),
    layout_policy: {
      minimum_traditional_template_ratio: 0.6,
      minimum_cover_frame_ratio: 0.9,
      minimum_hero_or_standard_zone_ratio: 0.8,
      maximum_external_layout_ratio: 0.1,
      external_layout_exception_ids: [],
      non_cover_exception_ids: [],
      compact_text_exception_ids: []
    },
    parts
  }
  const status = memeReviewBatchStatusSchema.parse({
    version: 1,
    batch: targetBatch,
    status: 'generating',
    message:
      mode === punctuationRefinementMode
        ? `${immediateReviewableSlugs.length} unchanged scenarios are available now; ${mutableScenarioSlugs.size} punctuation-refinement scenarios remain WIP.`
        : `${immediateReviewableSlugs.length} unchanged scenarios are available now; ${mutableScenarioSlugs.size} typography-refinement scenarios remain WIP.`,
    updatedAt: createdAt,
    reviewable_scenarios: immediateReviewableSlugs
  })

  memeIdeaCollectionV2Schema.parse(targetIdeas)
  memeReviewAssetCollectionSchema.parse(targetAssets)
  validateAssetReferences(targetIdeas, targetAssets, `Batch ${targetBatch}`)
  assertFinalizedMemesPreserved(
    {
      ideas: source.ideas,
      assets: source.assets,
      feedback: source.feedback.feedback
    },
    {
      ideas: targetIdeas,
      assets: targetAssets,
      feedback: targetFeedback.feedback
    }
  )

  return {
    ideas: targetIdeas,
    assets: targetAssets,
    feedback: targetFeedback,
    status,
    generationPlan,
    parts: preparedParts
  }
}

function actionForIdea({
  feedback,
  disabled,
  mode
}: {
  readonly feedback: MemeFeedbackEntry | undefined
  readonly disabled: boolean
  readonly mode: MemeReviewPreparationMode
}): MemeReviewGenerationAction | null {
  if (feedback?.locked) return 'finalized'
  if (feedback?.rating === 'dislike') return null
  if (disabled) return 'disabled-unchanged'
  if (mode === punctuationRefinementMode) {
    return hasAdditionalPunctuationPassWork(feedback?.notes)
      ? 'bounded-revision'
      : 'punctuation-only'
  }
  if (!feedback?.rating) {
    return feedback?.notes.trim() ? 'bounded-revision' : 'layout-only'
  }
  if (feedback?.rating === 'like' || feedback?.rating === 'neutral') {
    return feedback.notes.trim() ? 'bounded-revision' : 'layout-only'
  }
  return null
}

function planIdea(
  scenarioSlug: string,
  idea: MemeIdeaV2,
  feedback: MemeFeedbackEntry | undefined,
  action: MemeReviewGenerationAction
): MemeReviewGenerationPlanIdea {
  return {
    id: idea.id,
    scenario_slug: scenarioSlug,
    action,
    source_idea_sha256: memeReviewIdeaHash(idea),
    source_editorial_sha256: memeReviewIdeaEditorialHash(idea),
    allowed_changed_fields: allowedChangedFields(action),
    source_feedback: feedback ?? null
  }
}

function droppedPlanIdea(
  scenarioSlug: string,
  idea: MemeIdeaV2,
  feedback: MemeFeedbackEntry | undefined
): MemeReviewDroppedPlanIdea {
  return {
    id: idea.id,
    scenario_slug: scenarioSlug,
    source_idea_sha256: memeReviewIdeaHash(idea),
    source_editorial_sha256: memeReviewIdeaEditorialHash(idea),
    source_feedback: feedback ?? null
  }
}

function allowedChangedFields(
  action: MemeReviewGenerationAction
): readonly MemeReviewMutableField[] {
  if (action === 'layout-only') {
    return ['preview', 'frame_guidance', 'critic', 'assets']
  }
  if (action === 'bounded-revision') {
    return [
      'caption_lines',
      'preview',
      'frame_guidance',
      'why_it_works',
      'critic',
      'assets'
    ]
  }
  if (action === 'punctuation-only') return ['caption_lines']
  return []
}

function isMutableAction(action: MemeReviewGenerationAction) {
  return (
    action === 'layout-only' ||
    action === 'bounded-revision' ||
    action === 'punctuation-only'
  )
}

const punctuationOnlyNotePattern =
  /^remove\s+(?:all\s+)?the\s+periods?(?:\s+at\s+the\s+end)?[.!]?$/i

function hasAdditionalPunctuationPassWork(notes: string | undefined) {
  const trimmedNotes = notes?.trim()
  return Boolean(trimmedNotes && !punctuationOnlyNotePattern.test(trimmedNotes))
}

function validateSourceBatch(source: MemeReviewPreparationSourceBatch) {
  if (source.status.status !== 'ready') {
    throw new Error(
      `Source Batch ${source.number} is ${source.status.status}; finish it before preparing another batch`
    )
  }
  if (
    source.feedback.round !== source.number ||
    source.status.batch !== source.number
  ) {
    throw new Error(`Source Batch ${source.number} metadata is inconsistent`)
  }

  const ideaIds = new Set(
    source.ideas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
  )
  const scenarioSlugs = new Set(
    source.ideas.map(({ scenario_slug }) => scenario_slug)
  )
  const unknownFeedbackIds = Object.keys(source.feedback.feedback).filter(
    (id) => !ideaIds.has(id)
  )
  if (unknownFeedbackIds.length) {
    throw new Error(
      `Source feedback references unknown ideas: ${unknownFeedbackIds.join(', ')}`
    )
  }

  const unknownScenarioStates = Object.keys(source.feedback.scenarios).filter(
    (slug) => !scenarioSlugs.has(slug)
  )
  if (unknownScenarioStates.length) {
    throw new Error(
      `Source feedback references unknown scenarios: ${unknownScenarioStates.join(', ')}`
    )
  }

  const finalizedWithoutPointers = Object.entries(source.feedback.feedback)
    .filter(([, feedback]) => feedback.locked && !feedback.finalizedVersion)
    .map(([id]) => id)
  if (finalizedWithoutPointers.length) {
    throw new Error(
      `Source finalized ideas need exact version pointers: ${finalizedWithoutPointers.join(', ')}`
    )
  }

  validateAssetReferences(
    source.ideas,
    source.assets,
    `Source Batch ${source.number}`
  )
}

async function readSourceBatch(
  sourcePath: string,
  sourceNumber: number
): Promise<MemeReviewPreparationSourceBatch> {
  const fileNames: readonly MemeReviewSourceFileName[] = [
    'ideas.json',
    'assets.json',
    'feedback.json',
    'status.json'
  ]
  const entries = await Promise.all(
    fileNames.map(
      async (name) =>
        [name, await readFile(join(sourcePath, name), 'utf8')] as const
    )
  )
  const texts = Object.fromEntries(entries) as Record<
    MemeReviewSourceFileName,
    string
  >
  const files = Object.fromEntries(
    fileNames.map((name) => [
      name,
      {
        bytes: Buffer.byteLength(texts[name]),
        sha256: sha256(texts[name])
      }
    ])
  ) as Record<MemeReviewSourceFileName, MemeReviewSourceFileDigest>

  return {
    number: sourceNumber,
    ideas: memeIdeaCollectionV2Schema.parse(JSON.parse(texts['ideas.json'])),
    assets: memeReviewAssetCollectionSchema.parse(
      JSON.parse(texts['assets.json'])
    ),
    feedback: memeReviewStateDocumentSchema.parse(
      JSON.parse(texts['feedback.json'])
    ),
    status: memeReviewBatchStatusSchema.parse(JSON.parse(texts['status.json'])),
    files
  }
}

async function writePreparedBatch(
  stagingPath: string,
  prepared: PreparedMemeReviewBatch
) {
  await Promise.all([
    mkdir(join(stagingPath, 'parts')),
    mkdir(join(stagingPath, 'asset-parts')),
    mkdir(join(stagingPath, 'briefs')),
    writeJsonExclusiveOrVerify(join(stagingPath, 'ideas.json'), prepared.ideas),
    writeJsonExclusiveOrVerify(
      join(stagingPath, 'assets.json'),
      prepared.assets
    ),
    writeJsonExclusiveOrVerify(
      join(stagingPath, 'feedback.json'),
      prepared.feedback
    ),
    writeJsonExclusiveOrVerify(
      join(stagingPath, 'status.json'),
      prepared.status
    ),
    writeJsonExclusiveOrVerify(
      join(stagingPath, 'generation-plan.json'),
      prepared.generationPlan
    )
  ])

  await Promise.all(
    prepared.parts.flatMap(({ name, ideas, assets, brief }) => [
      writeJsonExclusiveOrVerify(
        join(stagingPath, 'parts', `${name}.json`),
        ideas
      ),
      writeJsonExclusiveOrVerify(
        join(stagingPath, 'asset-parts', `${name}.json`),
        assets
      ),
      writeJsonExclusiveOrVerify(
        join(stagingPath, 'briefs', `${name}.json`),
        brief
      )
    ])
  )
}

async function validateStagedBatch(
  stagingPath: string,
  prepared: PreparedMemeReviewBatch,
  targetBatch: number
) {
  const [rawIdeas, rawAssets, rawFeedback, rawStatus] = await Promise.all([
    readJsonFile(join(stagingPath, 'ideas.json')),
    readJsonFile(join(stagingPath, 'assets.json')),
    readJsonFile(join(stagingPath, 'feedback.json')),
    readJsonFile(join(stagingPath, 'status.json'))
  ])
  const ideas = memeIdeaCollectionV2Schema.parse(rawIdeas)
  const assets = memeReviewAssetCollectionSchema.parse(rawAssets)
  const feedback = memeReviewStateDocumentSchema.parse(rawFeedback)
  const status = memeReviewBatchStatusSchema.parse(rawStatus)

  if (feedback.round !== targetBatch || status.batch !== targetBatch) {
    throw new Error(`Staged Batch ${targetBatch} metadata is inconsistent`)
  }
  validateAssetReferences(ideas, assets, `Staged Batch ${targetBatch}`)
  if (
    JSON.stringify(ideas) !== JSON.stringify(prepared.ideas) ||
    JSON.stringify(assets) !== JSON.stringify(prepared.assets)
  ) {
    throw new Error(`Staged Batch ${targetBatch} changed during serialization`)
  }
}

function validateAssetReferences(
  ideas: readonly ScenarioMemeIdeasV2[],
  assets: readonly MemeReviewAsset[],
  label: string
) {
  const scenarioSlugs = new Set(ideas.map(({ scenario_slug }) => scenario_slug))
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))

  for (const asset of assets) {
    if (!scenarioSlugs.has(asset.scenario_slug)) {
      throw new Error(
        `${label} asset belongs to an inactive scenario: ${asset.id}`
      )
    }
  }

  for (const scenario of ideas) {
    for (const idea of scenario.ideas) {
      for (const assetId of idea.preview.asset_ids) {
        const asset = assetsById.get(assetId)
        if (!asset) {
          throw new Error(
            `${label} idea ${idea.id} references missing asset ${assetId}`
          )
        }
        if (asset.scenario_slug !== scenario.scenario_slug) {
          throw new Error(
            `${label} idea ${idea.id} references another scenario's asset ${assetId}`
          )
        }
      }
    }
  }
}

function countIdeas(scenarios: readonly ScenarioMemeIdeasV2[]) {
  return scenarios.reduce((total, { ideas }) => total + ideas.length, 0)
}

function parseRoundName(name: string, label: string) {
  const match = /^round-(\d{2,})$/.exec(name)
  const number = Number(match?.[1])
  const canonicalName = Number.isInteger(number)
    ? `round-${String(number).padStart(2, '0')}`
    : null
  if (!match || number < 1 || canonicalName !== name) {
    throw new Error(`Invalid ${label} batch name: ${name}`)
  }
  return number
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return false
    }
    throw err
  }
}

async function run() {
  const args = parseCliArguments(process.argv.slice(2))
  if ('help' in args) {
    console.log(
      'Usage: pnpm memes:prepare-batch -- --source=round-04 --target=round-05 --mode=punctuation-refinement'
    )
    return
  }

  const result = await prepareMemeReviewBatch(args)
  console.log(
    `Prepared Batch ${result.targetBatch} atomically: ${result.target_scenarios} scenarios, ${result.target_ideas} ideas, ${result.mutable_scenarios} WIP scenarios across ${result.parts.length} parts, and ${result.immediateReviewableScenarios} scenarios immediately reviewable.`
  )
}

function parseCliArguments(
  arguments_: readonly string[]
): { readonly help: true } | PrepareMemeReviewBatchOptions {
  if (arguments_.includes('--help')) return { help: true }

  const supportedPrefixes = ['--source=', '--target=', '--mode=']
  const unknown = arguments_.filter(
    (argument) =>
      !supportedPrefixes.some((prefix) => argument.startsWith(prefix))
  )
  if (unknown.length) {
    throw new Error(`Unknown arguments: ${unknown.join(', ')}`)
  }

  const values = Object.fromEntries(
    supportedPrefixes.map((prefix) => [
      prefix.slice(2, -1),
      arguments_
        .find((argument) => argument.startsWith(prefix))
        ?.slice(prefix.length)
    ])
  )
  if (
    !values.source ||
    !values.target ||
    ![layoutRefinementMode, punctuationRefinementMode].includes(
      values.mode as MemeReviewPreparationMode
    )
  ) {
    throw new Error(
      'Pass --source=round-04 --target=round-05 --mode=punctuation-refinement'
    )
  }

  return {
    source: values.source,
    target: values.target,
    mode: values.mode as MemeReviewPreparationMode
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await run()
}
