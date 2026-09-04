import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { z } from 'zod'

import { withMemeReviewFileLock } from '../lib/meme-review/file-lock'
import { assertFinalizedMemesPreserved } from '../lib/meme-review/finalization'
import {
  memeFeedbackEntrySchema,
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewBatchStatusSchema,
  memeReviewStateDocumentSchema,
  type MemeIdeaV2,
  type MemeReviewAsset,
  type ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import { assertValidMemeReviewBatch } from './meme-review-batch-validator'
import {
  memeReviewIdeaEditorialHash,
  memeReviewIdeaHash,
  memeReviewRoundsPath,
  readJson,
  sha256,
  stripTerminalMemePeriods,
  writeJsonAtomic
} from './meme-review-round-utils'

const partNameSchema = z.string().regex(/^part-\d{2}$/)
const digestSchema = z.object({
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
})
const changedFieldSchema = z.enum([
  'caption_lines',
  'preview',
  'frame_guidance',
  'why_it_works',
  'critic',
  'assets'
])
const planActionSchema = z.enum([
  'finalized',
  'disabled-unchanged',
  'layout-only',
  'bounded-revision',
  'punctuation-only'
])
const planIdeaSchema = z.object({
  id: z.string().trim().min(1),
  scenario_slug: z.string().trim().min(1),
  action: planActionSchema,
  source_idea_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source_editorial_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  allowed_changed_fields: z.array(changedFieldSchema),
  source_feedback: memeFeedbackEntrySchema.nullable()
})
const droppedIdeaSchema = planIdeaSchema.omit({
  action: true,
  allowed_changed_fields: true
})
const generationPlanSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['layout-refinement', 'punctuation-refinement']),
  source_batch: z.number().int().positive(),
  target_batch: z.number().int().positive(),
  created_at: z.iso.datetime(),
  source_files: z.object({
    'ideas.json': digestSchema,
    'assets.json': digestSchema,
    'feedback.json': digestSchema,
    'status.json': digestSchema
  }),
  counts: z.object({
    source_scenarios: z.number().int().nonnegative(),
    source_ideas: z.number().int().nonnegative(),
    target_scenarios: z.number().int().nonnegative(),
    target_ideas: z.number().int().nonnegative(),
    mutable_scenarios: z.number().int().nonnegative(),
    mutable_ideas: z.number().int().nonnegative(),
    finalized_ideas: z.number().int().nonnegative(),
    disabled_scenarios: z.number().int().nonnegative(),
    dropped_scenarios: z.number().int().nonnegative(),
    dropped_ideas: z.number().int().nonnegative()
  }),
  ideas: z.array(planIdeaSchema),
  dropped_ideas: z.array(droppedIdeaSchema),
  asset_revision_idea_ids: z.array(z.string().trim().min(1)),
  layout_policy: z.object({
    minimum_traditional_template_ratio: z.literal(0.6),
    minimum_cover_frame_ratio: z.literal(0.9),
    minimum_hero_or_standard_zone_ratio: z.literal(0.8),
    maximum_external_layout_ratio: z.literal(0.1),
    external_layout_exception_ids: z.array(z.string().trim().min(1)),
    non_cover_exception_ids: z.array(z.string().trim().min(1)),
    compact_text_exception_ids: z.array(z.string().trim().min(1))
  }),
  parts: z.array(
    z.object({
      part: partNameSchema,
      scenario_slugs: z.array(z.string().trim().min(1)),
      idea_ids: z.array(z.string().trim().min(1))
    })
  )
})
const generationBriefSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['layout-refinement', 'punctuation-refinement']),
  source_batch: z.number().int().positive(),
  target_batch: z.number().int().positive(),
  part: partNameSchema,
  instructions: z.object({
    scope: z.string().trim().min(1),
    finalized: z.string().trim().min(1),
    layout_only: z.string().trim().min(1),
    bounded_revision: z.string().trim().min(1),
    punctuation_only: z.string().trim().min(1).optional()
  }),
  scenarios: z.array(
    z.object({
      scenario_slug: z.string().trim().min(1),
      ideas: z.array(planIdeaSchema)
    })
  )
})

type GenerationPlan = z.infer<typeof generationPlanSchema>
type PlanIdea = z.infer<typeof planIdeaSchema>

export type PublishMemeReviewPartsOptions = {
  readonly roundName: string
  readonly requestedParts: readonly string[]
  readonly checkOnly?: boolean
  readonly stageOnly?: boolean
  readonly complete?: boolean
  readonly roundsPath?: string
}

export type PublishMemeReviewPartsResult = {
  readonly scenarios: number
  readonly reviewableScenarios: number
  readonly status: 'generating' | 'ready'
}

export async function publishMemeReviewParts({
  roundName,
  requestedParts,
  checkOnly = false,
  stageOnly = false,
  complete = false,
  roundsPath = memeReviewRoundsPath
}: PublishMemeReviewPartsOptions): Promise<PublishMemeReviewPartsResult> {
  if (!/^round-\d{2,}$/.test(roundName)) {
    throw new Error('Choose a batch such as --round=round-03')
  }
  if (stageOnly && complete) {
    throw new Error('--stage and --complete cannot be used together')
  }
  if (!requestedParts.length && !complete) {
    throw new Error('Choose completed parts, for example --parts=01,02')
  }

  const normalizedParts = requestedParts.map((part) =>
    part.startsWith('part-') ? part : `part-${part}`
  )
  if (
    normalizedParts.some((part) => !partNameSchema.safeParse(part).success) ||
    new Set(normalizedParts).size !== normalizedParts.length
  ) {
    throw new Error('Choose unique completed parts, for example --parts=01,02')
  }

  const roundNumber = Number(roundName.slice('round-'.length))
  const roundPath = join(roundsPath, roundName)
  const feedbackPath = join(roundPath, 'feedback.json')

  return withMemeReviewFileLock(feedbackPath, async () => {
    const [rawActiveIdeas, rawActiveAssets, rawFeedback, rawStatus, rawPlan] =
      await Promise.all([
        readJson(join(roundPath, 'ideas.json')),
        readJson(join(roundPath, 'assets.json')),
        readJson(feedbackPath),
        readJson(join(roundPath, 'status.json')),
        readJson(join(roundPath, 'generation-plan.json'))
      ])
    const activeIdeas = memeIdeaCollectionV2Schema.parse(rawActiveIdeas)
    const activeAssets = memeReviewAssetCollectionSchema.parse(rawActiveAssets)
    const feedback = memeReviewStateDocumentSchema.parse(rawFeedback)
    const status = memeReviewBatchStatusSchema.parse(rawStatus)
    const plan = generationPlanSchema.parse(rawPlan)

    if (
      feedback.round !== roundNumber ||
      status.batch !== roundNumber ||
      plan.target_batch !== roundNumber
    ) {
      throw new Error(
        `${roundName} metadata does not agree on its batch number`
      )
    }
    if (status.status === 'ready') {
      throw new Error(
        `${roundName} is already fully ready and cannot be republished`
      )
    }

    const source = await loadAndValidateSourceSnapshot(plan, roundsPath)
    validateGenerationPlan(plan, source.ideas, source.feedback.feedback)
    validateTargetAgainstPlan(activeIdeas, plan, source.ideas)
    assertFinalizedMemesPreserved(
      {
        ideas: source.ideas,
        assets: source.assets,
        feedback: source.feedback.feedback
      },
      {
        ideas: activeIdeas,
        assets: activeAssets,
        feedback: feedback.feedback
      }
    )

    const partPayloads = await Promise.all(
      normalizedParts.map(async (part) => {
        const [rawIdeas, rawAssets, rawBrief] = await Promise.all([
          readJson(join(roundPath, 'parts', `${part}.json`)),
          readJson(join(roundPath, 'asset-parts', `${part}.json`)),
          readJson(join(roundPath, 'briefs', `${part}.json`))
        ])

        assertCompletedPart(rawIdeas, rawAssets, part)
        const ideas = memeIdeaCollectionV2Schema.parse(rawIdeas)
        const assets = memeReviewAssetCollectionSchema.parse(rawAssets)
        const brief = generationBriefSchema.parse(rawBrief)
        validatePartAgainstPlan({ part, ideas, assets, brief, plan })

        return { ideas, assets }
      })
    )
    const replacementIdeas = partPayloads.flatMap(({ ideas }) => ideas)
    const replacementAssets = partPayloads.flatMap(({ assets }) => assets)
    const replacementIdeasBySlug = uniqueMap(
      replacementIdeas,
      ({ scenario_slug }) => scenario_slug,
      'scenario'
    )
    const replacementAssetsBySlug = Map.groupBy(
      replacementAssets,
      ({ scenario_slug }) => scenario_slug
    )
    const activeIdeasBySlug = new Map(
      activeIdeas.map((scenario) => [scenario.scenario_slug, scenario])
    )
    const activeAssetsBySlug = Map.groupBy(
      activeAssets,
      ({ scenario_slug }) => scenario_slug
    )
    const sourceIdeasById = indexIdeas(source.ideas)
    const planIdeasById = new Map(plan.ideas.map((idea) => [idea.id, idea]))
    const alreadyReviewable = new Set(status.reviewable_scenarios)

    for (const [scenarioSlug, replacement] of replacementIdeasBySlug) {
      const current = activeIdeasBySlug.get(scenarioSlug)
      const assets = replacementAssetsBySlug.get(scenarioSlug)
      if (!current || !assets?.length) {
        throw new Error(`${scenarioSlug} is not a complete active scenario`)
      }

      assertAssetReferences(replacement, assets)
      for (const idea of replacement.ideas) {
        const planIdea = planIdeasById.get(idea.id)
        const sourceIdea = sourceIdeasById.get(idea.id)?.idea
        if (!planIdea || !sourceIdea) {
          throw new Error(`${idea.id} is not authorized by the generation plan`)
        }
        assertAllowedIdeaChanges(sourceIdea, idea, planIdea, plan.mode, true)
      }

      if (alreadyReviewable.has(scenarioSlug)) {
        const currentAssets = activeAssetsBySlug.get(scenarioSlug) ?? []
        if (
          !isDeepStrictEqual(current, replacement) ||
          !isDeepStrictEqual(currentAssets, assets)
        ) {
          throw new Error(
            `Refusing to revise already-reviewable scenario ${scenarioSlug}`
          )
        }
        continue
      }

      const exposedIdeaIds = new Set([
        ...current.ideas.map(({ id }) => id),
        ...replacement.ideas.map(({ id }) => id)
      ])
      const nonfinalizedReview = Object.entries(feedback.feedback).find(
        ([ideaId, entry]) => exposedIdeaIds.has(ideaId) && !entry.locked
      )
      if (nonfinalizedReview) {
        throw new Error(
          `Refusing to replace ${scenarioSlug}; ${nonfinalizedReview[0]} has nonfinalized feedback`
        )
      }
    }

    const publishedIdeas = activeIdeas.map(
      (scenario) =>
        replacementIdeasBySlug.get(scenario.scenario_slug) ?? scenario
    )
    const publishedAssets = activeIdeas.flatMap(
      (scenario) =>
        replacementAssetsBySlug.get(scenario.scenario_slug) ??
        activeAssetsBySlug.get(scenario.scenario_slug) ??
        []
    )
    const reviewableScenarios = stageOnly
      ? status.reviewable_scenarios
      : [
          ...new Set([
            ...status.reviewable_scenarios,
            ...replacementIdeas.map(({ scenario_slug }) => scenario_slug)
          ])
        ]

    memeIdeaCollectionV2Schema.parse(publishedIdeas)
    memeReviewAssetCollectionSchema.parse(publishedAssets)
    validateTargetAgainstPlan(publishedIdeas, plan, source.ideas)
    assertFinalizedMemesPreserved(
      {
        ideas: activeIdeas,
        assets: activeAssets,
        feedback: feedback.feedback
      },
      {
        ideas: publishedIdeas,
        assets: publishedAssets,
        feedback: feedback.feedback
      }
    )
    const enabledScenarioSlugs = publishedIdeas
      .map(({ scenario_slug }) => scenario_slug)
      .filter((scenarioSlug) => !feedback.scenarios[scenarioSlug]?.disabled)
    const reviewableSet = new Set(reviewableScenarios)
    const incompleteEnabledScenarios = enabledScenarioSlugs.filter(
      (scenarioSlug) => !reviewableSet.has(scenarioSlug)
    )
    if (complete && incompleteEnabledScenarios.length) {
      throw new Error(
        `Cannot complete ${roundName}; enabled scenarios are not reviewable: ${incompleteEnabledScenarios.join(', ')}`
      )
    }
    const selectedIdeaIds = new Set(
      complete
        ? plan.ideas.flatMap(({ id, action }) =>
            isMutableAction(action) ? [id] : []
          )
        : normalizedParts.flatMap(
            (part) =>
              plan.parts.find((candidate) => candidate.part === part)
                ?.idea_ids ?? []
          )
    )
    assertValidMemeReviewBatch({
      sourceIdeas: source.ideas,
      sourceAssets: source.assets,
      sourceFeedback: source.feedback,
      targetIdeas: publishedIdeas,
      targetAssets: publishedAssets,
      targetFeedback: feedback,
      plan,
      metricIdeaIds: selectedIdeaIds
    })

    const nextStatus = complete ? ('ready' as const) : status.status
    if (!checkOnly) {
      const transitionalAssets = unionAssets(activeAssets, publishedAssets)
      await writeJsonAtomic(join(roundPath, 'assets.json'), transitionalAssets)
      await writeJsonAtomic(join(roundPath, 'ideas.json'), publishedIdeas)
      await writeJsonAtomic(join(roundPath, 'assets.json'), publishedAssets)
      await writeJsonAtomic(join(roundPath, 'status.json'), {
        ...status,
        status: nextStatus,
        message: complete
          ? `READY FOR REVIEW — all ${enabledScenarioSlugs.length} enabled scenarios have completed Batch ${roundNumber}.`
          : stageOnly
            ? `Staged ${replacementIdeas.length} scenarios. They remain unavailable until publication.`
            : `Review the ${reviewableScenarios.length} completed scenarios now. Orange WIP scenarios remain unavailable until their generation and composition audit is complete.`,
        updatedAt: new Date().toISOString(),
        reviewable_scenarios: reviewableScenarios
      })
    }

    return {
      scenarios: replacementIdeas.length,
      reviewableScenarios: reviewableScenarios.length,
      status: nextStatus
    }
  })
}

async function loadAndValidateSourceSnapshot(
  plan: GenerationPlan,
  roundsPath: string
) {
  const sourceRoundName = `round-${String(plan.source_batch).padStart(2, '0')}`
  const sourcePath = join(roundsPath, sourceRoundName)
  const fileNames = [
    'ideas.json',
    'assets.json',
    'feedback.json',
    'status.json'
  ] as const
  const contents = Object.fromEntries(
    await Promise.all(
      fileNames.map(async (fileName) => {
        const text = await readFile(join(sourcePath, fileName), 'utf8')
        const expected = plan.source_files[fileName]
        const actual = {
          bytes: Buffer.byteLength(text),
          sha256: sha256(text)
        }
        if (!isDeepStrictEqual(actual, expected)) {
          throw new Error(
            `Source ${sourceRoundName}/${fileName} no longer matches the generation plan`
          )
        }
        return [fileName, JSON.parse(text) as unknown] as const
      })
    )
  ) as Record<(typeof fileNames)[number], unknown>

  const ideas = memeIdeaCollectionV2Schema.parse(contents['ideas.json'])
  const assets = memeReviewAssetCollectionSchema.parse(contents['assets.json'])
  const feedback = memeReviewStateDocumentSchema.parse(
    contents['feedback.json']
  )
  const status = memeReviewBatchStatusSchema.parse(contents['status.json'])
  if (
    feedback.round !== plan.source_batch ||
    status.batch !== plan.source_batch
  ) {
    throw new Error('Generation-plan source metadata has the wrong batch')
  }

  return { ideas, assets, feedback }
}

function validateGenerationPlan(
  plan: GenerationPlan,
  sourceIdeas: readonly ScenarioMemeIdeasV2[],
  sourceFeedback: Readonly<
    Record<string, z.infer<typeof memeFeedbackEntrySchema>>
  >
) {
  if (plan.source_batch >= plan.target_batch) {
    throw new Error('Generation plan must advance to a later batch')
  }

  const sourceIdeasById = indexIdeas(sourceIdeas)
  const retainedIds = uniqueSet(
    plan.ideas.map(({ id }) => id),
    'generation-plan idea'
  )
  const droppedIds = uniqueSet(
    plan.dropped_ideas.map(({ id }) => id),
    'dropped generation-plan idea'
  )
  for (const id of retainedIds) {
    if (droppedIds.has(id)) {
      throw new Error(`Generation plan both retains and drops ${id}`)
    }
  }

  const sourceIds = new Set(sourceIdeasById.keys())
  const plannedSourceIds = new Set([...retainedIds, ...droppedIds])
  assertSameSet(plannedSourceIds, sourceIds, 'generation-plan source idea')

  for (const entry of [...plan.ideas, ...plan.dropped_ideas]) {
    const sourceMatch = sourceIdeasById.get(entry.id)
    if (!sourceMatch || sourceMatch.scenarioSlug !== entry.scenario_slug) {
      throw new Error(`${entry.id} has the wrong source scenario in the plan`)
    }
    if (memeReviewIdeaHash(sourceMatch.idea) !== entry.source_idea_sha256) {
      throw new Error(`${entry.id} has a stale source-idea hash`)
    }
    if (
      memeReviewIdeaEditorialHash(sourceMatch.idea) !==
      entry.source_editorial_sha256
    ) {
      throw new Error(`${entry.id} has a stale source-editorial hash`)
    }
    if (
      !isDeepStrictEqual(
        sourceFeedback[entry.id] ?? null,
        entry.source_feedback
      )
    ) {
      throw new Error(`${entry.id} has stale source feedback in the plan`)
    }
  }

  for (const idea of plan.ideas) assertCanonicalAllowedFields(idea)

  uniqueSet(
    plan.parts.flatMap(({ scenario_slugs }) => scenario_slugs),
    'generation-plan part scenario'
  )
  uniqueSet(
    plan.parts.flatMap(({ idea_ids }) => idea_ids),
    'generation-plan part idea'
  )
  assertSameSet(
    new Set(plan.asset_revision_idea_ids),
    new Set(
      plan.ideas
        .filter(({ allowed_changed_fields }) =>
          allowed_changed_fields.includes('assets')
        )
        .map(({ id }) => id)
    ),
    'asset-revision idea'
  )

  const sourceScenarioSlugs = new Set(
    sourceIdeas.map(({ scenario_slug }) => scenario_slug)
  )
  const targetScenarioSlugs = new Set(
    plan.ideas.map(({ scenario_slug }) => scenario_slug)
  )
  const mutableIdeas = plan.ideas.filter(({ action }) =>
    isMutableAction(action)
  )
  const mutableScenarioSlugs = new Set(
    mutableIdeas.map(({ scenario_slug }) => scenario_slug)
  )
  assertSameSet(
    new Set(plan.parts.flatMap(({ scenario_slugs }) => scenario_slugs)),
    mutableScenarioSlugs,
    'generation-plan mutable scenario'
  )
  assertSameSet(
    new Set(plan.parts.flatMap(({ idea_ids }) => idea_ids)),
    new Set(
      plan.ideas
        .filter(({ scenario_slug }) => mutableScenarioSlugs.has(scenario_slug))
        .map(({ id }) => id)
    ),
    'generation-plan part idea'
  )
  const disabledScenarioSlugs = new Set(
    plan.ideas
      .filter(({ action }) => action === 'disabled-unchanged')
      .map(({ scenario_slug }) => scenario_slug)
  )
  const droppedScenarioSlugs = new Set(
    [...sourceScenarioSlugs].filter((slug) => !targetScenarioSlugs.has(slug))
  )
  const expectedCounts = {
    source_scenarios: sourceScenarioSlugs.size,
    source_ideas: sourceIds.size,
    target_scenarios: targetScenarioSlugs.size,
    target_ideas: plan.ideas.length,
    mutable_scenarios: mutableScenarioSlugs.size,
    mutable_ideas: mutableIdeas.length,
    finalized_ideas: plan.ideas.filter(({ action }) => action === 'finalized')
      .length,
    disabled_scenarios: disabledScenarioSlugs.size,
    dropped_scenarios: droppedScenarioSlugs.size,
    dropped_ideas: plan.dropped_ideas.length
  }
  if (!isDeepStrictEqual(plan.counts, expectedCounts)) {
    throw new Error('Generation-plan counts do not match its idea actions')
  }
}

function validateTargetAgainstPlan(
  targetIdeas: readonly ScenarioMemeIdeasV2[],
  plan: GenerationPlan,
  sourceIdeas: readonly ScenarioMemeIdeasV2[]
) {
  const sourceIdeasById = indexIdeas(sourceIdeas)
  const planIdeasById = new Map(plan.ideas.map((idea) => [idea.id, idea]))
  const targetIdeasById = indexIdeas(targetIdeas)
  assertSameSet(
    new Set(targetIdeasById.keys()),
    new Set(planIdeasById.keys()),
    'target idea'
  )

  for (const [id, targetMatch] of targetIdeasById) {
    const planIdea = planIdeasById.get(id)
    const sourceMatch = sourceIdeasById.get(id)
    if (
      !planIdea ||
      !sourceMatch ||
      planIdea.scenario_slug !== targetMatch.scenarioSlug ||
      sourceMatch.scenarioSlug !== targetMatch.scenarioSlug
    ) {
      throw new Error(`${id} moved to an unauthorized scenario`)
    }
    assertAllowedIdeaChanges(
      sourceMatch.idea,
      targetMatch.idea,
      planIdea,
      plan.mode,
      false
    )
  }
}

function validatePartAgainstPlan({
  part,
  ideas,
  assets,
  brief,
  plan
}: {
  readonly part: string
  readonly ideas: readonly ScenarioMemeIdeasV2[]
  readonly assets: readonly MemeReviewAsset[]
  readonly brief: z.infer<typeof generationBriefSchema>
  readonly plan: GenerationPlan
}) {
  const planPart = plan.parts.find((candidate) => candidate.part === part)
  if (!planPart) throw new Error(`${part} is not requested by the plan`)
  if (
    brief.part !== part ||
    brief.source_batch !== plan.source_batch ||
    brief.target_batch !== plan.target_batch
  ) {
    throw new Error(`${part} brief does not match the generation plan`)
  }

  const scenarioSlugs = ideas.map(({ scenario_slug }) => scenario_slug)
  assertSameOrderedValues(
    scenarioSlugs,
    planPart.scenario_slugs,
    `${part} scenario`
  )
  const ideaIds = ideas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
  assertSameOrderedValues(ideaIds, planPart.idea_ids, `${part} idea`)

  const briefScenarioSlugs = brief.scenarios.map(
    ({ scenario_slug }) => scenario_slug
  )
  assertSameOrderedValues(
    briefScenarioSlugs,
    planPart.scenario_slugs,
    `${part} brief scenario`
  )
  const planIdeasById = new Map(plan.ideas.map((idea) => [idea.id, idea]))
  const briefIdeas = brief.scenarios.flatMap(({ ideas }) => ideas)
  assertSameOrderedValues(
    briefIdeas.map(({ id }) => id),
    planPart.idea_ids,
    `${part} brief idea`
  )
  for (const briefIdea of briefIdeas) {
    if (!isDeepStrictEqual(briefIdea, planIdeasById.get(briefIdea.id))) {
      throw new Error(
        `${part} brief diverges from the plan for ${briefIdea.id}`
      )
    }
  }

  assertSameSet(
    new Set(assets.map(({ scenario_slug }) => scenario_slug)),
    new Set(planPart.scenario_slugs),
    `${part} asset scenario`
  )
}

function assertAllowedIdeaChanges(
  source: MemeIdeaV2,
  target: MemeIdeaV2,
  planIdea: PlanIdea,
  mode: GenerationPlan['mode'],
  requireCompleted: boolean
) {
  const allowed = new Set<string>(planIdea.allowed_changed_fields)
  for (const key of Object.keys(source) as (keyof MemeIdeaV2)[]) {
    if (allowed.has(key)) continue
    if (!isDeepStrictEqual(source[key], target[key])) {
      throw new Error(
        `${target.id} changed unrequested field ${key} for ${planIdea.action}`
      )
    }
  }

  if (mode !== 'punctuation-refinement') return

  if (planIdea.action === 'punctuation-only') {
    const expected = stripTerminalMemePeriods(source.caption_lines)
    const isPending = isDeepStrictEqual(
      target.caption_lines,
      source.caption_lines
    )
    if (!isDeepStrictEqual(target.caption_lines, expected)) {
      if (!requireCompleted && isPending) return
      throw new Error(
        `${target.id} made a non-canonical punctuation-only caption change`
      )
    }
  }

  if (
    planIdea.action === 'bounded-revision' &&
    requireCompleted &&
    hasRemovableTerminalPeriods(target.caption_lines)
  ) {
    throw new Error(
      `${target.id} bounded punctuation revision still has terminal periods`
    )
  }
}

function assertCanonicalAllowedFields(planIdea: PlanIdea) {
  const expected =
    planIdea.action === 'layout-only'
      ? ['preview', 'frame_guidance', 'critic', 'assets']
      : planIdea.action === 'bounded-revision'
        ? [
            'caption_lines',
            'preview',
            'frame_guidance',
            'why_it_works',
            'critic',
            'assets'
          ]
        : planIdea.action === 'punctuation-only'
          ? ['caption_lines']
          : []
  if (!isDeepStrictEqual(planIdea.allowed_changed_fields, expected)) {
    throw new Error(
      `${planIdea.id} has invalid allowances for ${planIdea.action}`
    )
  }
}

function isMutableAction(action: PlanIdea['action']) {
  return (
    action === 'layout-only' ||
    action === 'bounded-revision' ||
    action === 'punctuation-only'
  )
}

function hasRemovableTerminalPeriods(lines: readonly string[]) {
  return !isDeepStrictEqual(lines, stripTerminalMemePeriods(lines))
}

function indexIdeas(ideas: readonly ScenarioMemeIdeasV2[]) {
  return new Map(
    ideas.flatMap(({ scenario_slug, ideas }) =>
      ideas.map(
        (idea) => [idea.id, { scenarioSlug: scenario_slug, idea }] as const
      )
    )
  )
}

function assertCompletedPart(
  rawIdeas: unknown,
  rawAssets: unknown,
  part: string
) {
  if (!Array.isArray(rawIdeas) || !Array.isArray(rawAssets)) {
    throw new Error(`${part} must contain idea and asset arrays`)
  }

  for (const rawScenario of rawIdeas) {
    if (!isRecord(rawScenario) || !Array.isArray(rawScenario.ideas)) {
      throw new Error(`${part} contains a malformed scenario`)
    }
    for (const rawIdea of rawScenario.ideas) {
      if (
        isRecord(rawIdea) &&
        Object.keys(rawIdea).some((key) => /generation/i.test(key))
      ) {
        throw new Error(`${part} still contains generation metadata`)
      }
    }
  }

  for (const rawAsset of rawAssets) {
    if (!isRecord(rawAsset) || rawAsset.annotation_status !== 'complete') {
      throw new Error(`${part} still contains an uninspected asset`)
    }
  }
}

function assertAssetReferences(
  scenario: ScenarioMemeIdeasV2,
  assets: readonly MemeReviewAsset[]
) {
  const assetIds = new Set(assets.map(({ id }) => id))
  for (const idea of scenario.ideas) {
    for (const assetId of idea.preview.asset_ids) {
      if (!assetIds.has(assetId)) {
        throw new Error(`${idea.id} references missing asset ${assetId}`)
      }
    }
  }
}

function unionAssets(
  current: readonly MemeReviewAsset[],
  target: readonly MemeReviewAsset[]
) {
  const assets = new Map(current.map((asset) => [asset.id, asset]))
  for (const asset of target) assets.set(asset.id, asset)
  return [...assets.values()]
}

function uniqueMap<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
  label: string
) {
  const result = new Map<string, T>()
  for (const value of values) {
    const key = keyFor(value)
    if (result.has(key)) throw new Error(`Duplicate ${label}: ${key}`)
    result.set(key, value)
  }
  return result
}

function uniqueSet(values: readonly string[], label: string) {
  const result = new Set<string>()
  for (const value of values) {
    if (result.has(value)) throw new Error(`Duplicate ${label}: ${value}`)
    result.add(value)
  }
  return result
}

function assertSameSet(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
  label: string
) {
  const missing = [...expected].filter((value) => !actual.has(value))
  const unexpected = [...actual].filter((value) => !expected.has(value))
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} set differs; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
    )
  }
}

function assertSameOrderedValues(
  actual: readonly string[],
  expected: readonly string[],
  label: string
) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label} order or membership differs from the plan`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function argumentValue(arguments_: readonly string[], name: string) {
  const prefix = `--${name}=`
  return arguments_
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length)
}

export function parsePublishMemeReviewArguments(arguments_: readonly string[]) {
  const roundName = argumentValue(arguments_, 'round')
  if (!roundName) {
    throw new Error('An explicit --round=round-03 argument is required')
  }
  const requestedParts =
    argumentValue(arguments_, 'parts')
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean) ?? []

  return {
    roundName,
    requestedParts,
    checkOnly: arguments_.includes('--check'),
    stageOnly: arguments_.includes('--stage'),
    complete: arguments_.includes('--complete')
  }
}

async function main() {
  const options = parsePublishMemeReviewArguments(process.argv.slice(2))
  const result = await publishMemeReviewParts(options)
  const verb = options.checkOnly
    ? 'Validated'
    : options.complete
      ? 'Completed'
      : options.stageOnly
        ? 'Staged'
        : 'Published'
  console.log(
    `${verb} ${result.scenarios} scenarios; ${result.reviewableScenarios} scenarios are reviewable and the batch is ${result.status}.`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
