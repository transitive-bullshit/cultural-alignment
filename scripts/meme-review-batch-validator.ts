import { isDeepStrictEqual } from 'node:util'

import { assertFinalizedMemesPreserved } from '../lib/meme-review/finalization'
import type {
  MemeFeedbackEntry,
  MemeIdeaV2,
  MemeReviewAsset,
  MemeReviewStateDocument,
  ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import type {
  MemeReviewGenerationPlan,
  MemeReviewGenerationPlanIdea,
  MemeReviewMutableField
} from './prepare-meme-review-batch'
import {
  memeReviewIdeaEditorialHash,
  memeReviewIdeaHash,
  stripTerminalMemePeriods
} from './meme-review-round-utils'

const ordinaryFormats = new Set<MemeIdeaV2['format']>([
  'canon',
  'collision',
  'relabel'
])
const externalTemplates = new Set<MemeIdeaV2['preview']['template']>([
  'band-top',
  'band-bottom',
  'sidecar-left',
  'sidecar-right'
])
const layoutOnlyFields = new Set<MemeReviewMutableField>([
  'preview',
  'frame_guidance',
  'critic',
  'assets'
])
const boundedRevisionFields = new Set<MemeReviewMutableField>([
  'caption_lines',
  'preview',
  'frame_guidance',
  'why_it_works',
  'critic',
  'assets'
])
const punctuationOnlyFields = new Set<MemeReviewMutableField>(['caption_lines'])

export type MemeReviewValidationPlan = MemeReviewGenerationPlan

type ResolvedLayoutPolicy = {
  readonly minimumTraditionalRatio: number
  readonly minimumReadableSizeRatio: number
  readonly maximumCompactRatio: number
  readonly maximumExternalLayoutRatio: number
  readonly maximumNonCoverRatio: number
  readonly compactExceptions: ReadonlySet<string>
  readonly externalLayoutExceptions: ReadonlySet<string>
  readonly nonCoverExceptions: ReadonlySet<string>
}

export type MemeReviewLayoutMetric = {
  readonly passing: number
  readonly total: number
  readonly ratio: number
  readonly threshold: number
}

export type MemeReviewBatchValidationReport = {
  readonly issues: readonly string[]
  readonly metrics: {
    readonly strict_traditional: MemeReviewLayoutMetric
    readonly readable_ordinary_zones: MemeReviewLayoutMetric
    readonly compact_ordinary_zones: MemeReviewLayoutMetric
    readonly external_layouts: MemeReviewLayoutMetric
    readonly non_cover_frames: MemeReviewLayoutMetric
  }
}

export type MemeReviewBatchValidationInput = {
  readonly sourceIdeas: readonly ScenarioMemeIdeasV2[]
  readonly sourceAssets: readonly MemeReviewAsset[]
  readonly sourceFeedback: MemeReviewStateDocument
  readonly targetIdeas: readonly ScenarioMemeIdeasV2[]
  readonly targetAssets: readonly MemeReviewAsset[]
  readonly targetFeedback: MemeReviewStateDocument
  readonly plan: MemeReviewValidationPlan
  readonly metricIdeaIds?: ReadonlySet<string>
}

export function validateMemeReviewBatch(
  input: MemeReviewBatchValidationInput
): MemeReviewBatchValidationReport {
  const issues: string[] = []
  const policy = resolveLayoutPolicy(input.plan)
  const sourceIndex = indexIdeas(input.sourceIdeas)
  const targetIndex = indexIdeas(input.targetIdeas)
  const planById = uniquePlanMap(input.plan.ideas, 'retained', issues)
  const droppedById = uniquePlanMap(input.plan.dropped_ideas, 'dropped', issues)
  const sourceIds = new Set(sourceIndex.keys())
  const targetIds = new Set(targetIndex.keys())
  const retainedIds = new Set(planById.keys())
  const plannedSourceIds = new Set([...retainedIds, ...droppedById.keys()])

  for (const id of retainedIds) {
    if (droppedById.has(id)) {
      issues.push(`Generation plan both retains and drops idea ${id}`)
    }
  }

  reportSetDifference(
    [...sourceIds].filter((id) => !plannedSourceIds.has(id)),
    'Generation plan omitted source idea',
    issues
  )
  reportSetDifference(
    [...plannedSourceIds].filter((id) => !sourceIds.has(id)),
    'Generation plan references unknown source idea',
    issues
  )
  reportSetDifference(
    [...targetIds].filter((id) => !retainedIds.has(id)),
    'Target introduced unplanned idea',
    issues
  )
  reportSetDifference(
    [...retainedIds].filter((id) => !targetIds.has(id)),
    'Target dropped retained idea',
    issues
  )

  if (targetIds.size !== input.plan.counts.target_ideas) {
    issues.push(
      `Target contains ${targetIds.size} ideas; generation plan expects ${input.plan.counts.target_ideas}`
    )
  }
  if (input.targetIdeas.length !== input.plan.counts.target_scenarios) {
    issues.push(
      `Target contains ${input.targetIdeas.length} scenarios; generation plan expects ${input.plan.counts.target_scenarios}`
    )
  }
  if (input.sourceFeedback.round !== input.plan.source_batch) {
    issues.push(
      `Source feedback identifies Batch ${input.sourceFeedback.round}; generation plan expects Batch ${input.plan.source_batch}`
    )
  }
  if (input.targetFeedback.round !== input.plan.target_batch) {
    issues.push(
      `Target feedback identifies Batch ${input.targetFeedback.round}; generation plan expects Batch ${input.plan.target_batch}`
    )
  }

  const completedIdeaIds = input.metricIdeaIds ?? retainedIds

  for (const planIdea of input.plan.ideas) {
    validatePlannedIdea({
      planIdea,
      sourceMatch: sourceIndex.get(planIdea.id),
      targetMatch: targetIndex.get(planIdea.id),
      sourceFeedback: input.sourceFeedback.feedback[planIdea.id],
      targetFeedback: input.targetFeedback.feedback[planIdea.id],
      mode: input.plan.mode,
      requireCompleted: completedIdeaIds.has(planIdea.id),
      issues
    })
  }
  for (const planIdea of input.plan.dropped_ideas) {
    validateSourcePlanBinding(
      planIdea,
      sourceIndex.get(planIdea.id),
      input.sourceFeedback.feedback[planIdea.id],
      issues
    )
  }

  validateAssetReferences(input.targetIdeas, input.targetAssets, issues)
  validateAssetEvolution({
    sourceAssets: input.sourceAssets,
    targetAssets: input.targetAssets,
    targetIndex,
    planById,
    assetRevisionIdeaIds: new Set(input.plan.asset_revision_idea_ids),
    issues
  })

  try {
    assertFinalizedMemesPreserved(
      {
        ideas: input.sourceIdeas,
        assets: input.sourceAssets,
        feedback: input.sourceFeedback.feedback
      },
      {
        ideas: input.targetIdeas,
        assets: input.targetAssets,
        feedback: input.targetFeedback.feedback
      }
    )
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err))
  }

  const editableIdeas = input.plan.ideas.flatMap((planIdea) => {
    if (
      !planIdea.allowed_changed_fields.includes('preview') ||
      !completedIdeaIds.has(planIdea.id)
    ) {
      return []
    }
    const match = targetIndex.get(planIdea.id)
    return match ? [match.idea] : []
  })
  const metrics = measureLayouts(editableIdeas, policy)
  if (input.plan.mode === 'layout-refinement') {
    validateLayoutMetrics(metrics, issues)
  }
  validateDiptychs(editableIdeas, issues)

  return { issues, metrics }
}

export function assertValidMemeReviewBatch(
  input: MemeReviewBatchValidationInput
): MemeReviewBatchValidationReport {
  const report = validateMemeReviewBatch(input)
  if (report.issues.length) {
    throw new Error(
      `Meme review batch validation failed:\n- ${report.issues.join('\n- ')}`
    )
  }
  return report
}

function validatePlannedIdea({
  planIdea,
  sourceMatch,
  targetMatch,
  sourceFeedback,
  targetFeedback,
  mode,
  requireCompleted,
  issues
}: {
  readonly planIdea: MemeReviewGenerationPlanIdea
  readonly sourceMatch: IndexedIdea | undefined
  readonly targetMatch: IndexedIdea | undefined
  readonly sourceFeedback: MemeFeedbackEntry | undefined
  readonly targetFeedback: MemeFeedbackEntry | undefined
  readonly mode: MemeReviewGenerationPlan['mode']
  readonly requireCompleted: boolean
  readonly issues: string[]
}) {
  validateSourcePlanBinding(planIdea, sourceMatch, sourceFeedback, issues)
  if (
    planIdea.action === 'finalized' &&
    !isDeepStrictEqual(targetFeedback, sourceFeedback)
  ) {
    issues.push(`${planIdea.id} changed its finalized feedback snapshot`)
  }
  if (planIdea.action === 'finalized' && !sourceFeedback?.locked) {
    issues.push(`${planIdea.id} is planned as finalized without a source lock`)
  }
  if (!sourceMatch || !targetMatch) return

  if (sourceMatch.scenarioSlug !== planIdea.scenario_slug) {
    issues.push(
      `${planIdea.id} source scenario is ${sourceMatch.scenarioSlug}; plan expects ${planIdea.scenario_slug}`
    )
  }
  if (targetMatch.scenarioSlug !== planIdea.scenario_slug) {
    issues.push(
      `${planIdea.id} moved to scenario ${targetMatch.scenarioSlug}; plan expects ${planIdea.scenario_slug}`
    )
  }

  const allowedFields = validateAllowedFields(planIdea, issues)
  const changedFields = changedTopLevelFields(
    sourceMatch.idea,
    targetMatch.idea
  )
  for (const field of changedFields) {
    if (!allowedFields.has(field as MemeReviewMutableField)) {
      issues.push(
        `${planIdea.id} changed unauthorized field ${field} for ${planIdea.action}`
      )
    }
  }

  if (mode !== 'punctuation-refinement') return

  if (planIdea.action === 'punctuation-only') {
    const expected = stripTerminalMemePeriods(sourceMatch.idea.caption_lines)
    const pending = isDeepStrictEqual(
      targetMatch.idea.caption_lines,
      sourceMatch.idea.caption_lines
    )
    if (!isDeepStrictEqual(targetMatch.idea.caption_lines, expected)) {
      if (!requireCompleted && pending) return
      issues.push(
        `${planIdea.id} made a non-canonical punctuation-only caption change`
      )
    }
  }

  if (
    planIdea.action === 'bounded-revision' &&
    requireCompleted &&
    !isDeepStrictEqual(
      targetMatch.idea.caption_lines,
      stripTerminalMemePeriods(targetMatch.idea.caption_lines)
    )
  ) {
    issues.push(
      `${planIdea.id} bounded punctuation revision still has terminal periods`
    )
  }
}

function validateSourcePlanBinding(
  planIdea: Pick<
    MemeReviewGenerationPlanIdea,
    | 'id'
    | 'scenario_slug'
    | 'source_idea_sha256'
    | 'source_editorial_sha256'
    | 'source_feedback'
  >,
  sourceMatch: IndexedIdea | undefined,
  sourceFeedback: MemeFeedbackEntry | undefined,
  issues: string[]
) {
  if (!sourceMatch) return

  if (memeReviewIdeaHash(sourceMatch.idea) !== planIdea.source_idea_sha256) {
    issues.push(`${planIdea.id} no longer matches its planned source payload`)
  }
  if (
    memeReviewIdeaEditorialHash(sourceMatch.idea) !==
    planIdea.source_editorial_sha256
  ) {
    issues.push(
      `${planIdea.id} no longer matches its planned editorial payload`
    )
  }
  if (!isDeepStrictEqual(sourceFeedback ?? null, planIdea.source_feedback)) {
    issues.push(`${planIdea.id} source feedback changed after planning`)
  }
}

function validateAllowedFields(
  planIdea: MemeReviewGenerationPlanIdea,
  issues: string[]
) {
  const permittedByAction =
    planIdea.action === 'layout-only'
      ? layoutOnlyFields
      : planIdea.action === 'bounded-revision'
        ? boundedRevisionFields
        : planIdea.action === 'punctuation-only'
          ? punctuationOnlyFields
          : new Set<MemeReviewMutableField>()
  const allowedFields = new Set(planIdea.allowed_changed_fields)

  for (const field of allowedFields) {
    if (!permittedByAction.has(field)) {
      issues.push(
        `${planIdea.id} generation plan authorizes invalid ${planIdea.action} field ${field}`
      )
    }
  }
  if (
    planIdea.action === 'bounded-revision' &&
    !planIdea.source_feedback?.notes.trim()
  ) {
    issues.push(`${planIdea.id} is a bounded revision without written feedback`)
  }

  return allowedFields
}

function validateAssetReferences(
  ideas: readonly ScenarioMemeIdeasV2[],
  assets: readonly MemeReviewAsset[],
  issues: string[]
) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  for (const scenario of ideas) {
    for (const idea of scenario.ideas) {
      for (const assetId of idea.preview.asset_ids) {
        const asset = assetsById.get(assetId)
        if (!asset) {
          issues.push(`${idea.id} references missing asset ${assetId}`)
        } else if (asset.scenario_slug !== scenario.scenario_slug) {
          issues.push(
            `${idea.id} references another scenario's asset ${assetId}`
          )
        }
      }
    }
  }
}

function validateAssetEvolution({
  sourceAssets,
  targetAssets,
  targetIndex,
  planById,
  assetRevisionIdeaIds,
  issues
}: {
  readonly sourceAssets: readonly MemeReviewAsset[]
  readonly targetAssets: readonly MemeReviewAsset[]
  readonly targetIndex: ReadonlyMap<string, IndexedIdea>
  readonly planById: ReadonlyMap<string, MemeReviewGenerationPlanIdea>
  readonly assetRevisionIdeaIds: ReadonlySet<string>
  readonly issues: string[]
}) {
  const sourceAssetsById = new Map(
    sourceAssets.map((asset) => [asset.id, asset])
  )
  const targetReferences = new Map<string, string[]>()

  for (const [ideaId, { idea }] of targetIndex) {
    for (const assetId of idea.preview.asset_ids) {
      const references = targetReferences.get(assetId) ?? []
      references.push(ideaId)
      targetReferences.set(assetId, references)
    }
  }

  for (const targetAsset of targetAssets) {
    const sourceAsset = sourceAssetsById.get(targetAsset.id)
    if (sourceAsset && !isDeepStrictEqual(sourceAsset, targetAsset)) {
      issues.push(
        `Target changed immutable asset payload ${targetAsset.id}; allocate a new asset ID`
      )
      continue
    }
    if (sourceAsset) continue

    const references = targetReferences.get(targetAsset.id) ?? []
    if (references.length === 0) {
      issues.push(`Target introduced unreferenced asset ${targetAsset.id}`)
      continue
    }
    for (const ideaId of references) {
      const planIdea = planById.get(ideaId)
      if (
        !planIdea?.allowed_changed_fields.includes('assets') ||
        !assetRevisionIdeaIds.has(ideaId)
      ) {
        issues.push(
          `${ideaId} references new asset ${targetAsset.id} without asset authorization`
        )
      }
    }
  }
}

function measureLayouts(
  editableIdeas: readonly MemeIdeaV2[],
  policy: ResolvedLayoutPolicy
): MemeReviewBatchValidationReport['metrics'] {
  const ordinaryIdeas = editableIdeas.filter(({ format }) =>
    ordinaryFormats.has(format)
  )
  const traditionalCandidates = ordinaryIdeas.filter(
    (idea) => idea.caption_lines.length >= 2
  )
  const ordinaryZones = ordinaryIdeas.flatMap((idea) =>
    policy.compactExceptions.has(idea.id) ? [] : idea.preview.zones
  )
  const externalCandidates = editableIdeas.filter(
    ({ id }) => !policy.externalLayoutExceptions.has(id)
  )
  const nonCoverCandidates = editableIdeas.filter(
    ({ id }) => !policy.nonCoverExceptions.has(id)
  )

  return {
    strict_traditional: metric(
      traditionalCandidates.filter(isStrictTraditional).length,
      traditionalCandidates.length,
      policy.minimumTraditionalRatio,
      1
    ),
    readable_ordinary_zones: metric(
      ordinaryZones.filter(({ size }) =>
        ['standard', 'hero', 'display'].includes(size)
      ).length,
      ordinaryZones.length,
      policy.minimumReadableSizeRatio,
      1
    ),
    compact_ordinary_zones: metric(
      ordinaryZones.filter(({ size }) => size === 'compact').length,
      ordinaryZones.length,
      policy.maximumCompactRatio,
      0
    ),
    external_layouts: metric(
      externalCandidates.filter(({ preview }) =>
        externalTemplates.has(preview.template)
      ).length,
      externalCandidates.length,
      policy.maximumExternalLayoutRatio,
      0
    ),
    non_cover_frames: metric(
      nonCoverCandidates.filter(({ preview }) => preview.frame_mode !== 'cover')
        .length,
      nonCoverCandidates.length,
      policy.maximumNonCoverRatio,
      0
    )
  }
}

function validateLayoutMetrics(
  metrics: MemeReviewBatchValidationReport['metrics'],
  issues: string[]
) {
  requireMinimum(
    'Strict traditional layouts',
    metrics.strict_traditional,
    issues
  )
  requireMinimum(
    'Readable ordinary caption zones',
    metrics.readable_ordinary_zones,
    issues
  )
  requireMaximum(
    'Compact ordinary caption zones',
    metrics.compact_ordinary_zones,
    issues
  )
  requireMaximum('External layouts', metrics.external_layouts, issues)
  requireMaximum('Non-cover frames', metrics.non_cover_frames, issues)
}

function validateDiptychs(
  editableIdeas: readonly MemeIdeaV2[],
  issues: string[]
) {
  for (const idea of editableIdeas) {
    if (idea.preview.template !== 'diptych') continue
    const slots = idea.preview.zones.map(({ slot }) => slot)
    if (
      slots.length !== 2 ||
      !slots.includes('panel-left') ||
      !slots.includes('panel-right')
    ) {
      issues.push(
        `${idea.id} diptych must use exactly one panel-left and one panel-right caption zone`
      )
    }
  }
}

function isStrictTraditional(idea: MemeIdeaV2) {
  if (
    idea.preview.template !== 'overlay' ||
    idea.preview.frame_mode !== 'cover' ||
    idea.preview.zones.length !== 2
  ) {
    return false
  }

  const top = idea.preview.zones.find(({ slot }) => slot === 'top')
  const bottom = idea.preview.zones.find(({ slot }) => slot === 'bottom')
  if (!top || !bottom || top.size !== bottom.size) return false
  if (
    [top, bottom].some(
      (zone) =>
        zone.style !== 'impact' ||
        zone.align !== 'center' ||
        zone.size === 'compact'
    )
  ) {
    return false
  }

  return Math.max(...top.lines) < Math.min(...bottom.lines)
}

function resolveLayoutPolicy(
  plan: MemeReviewValidationPlan
): ResolvedLayoutPolicy {
  const policy = plan.layout_policy
  return {
    minimumTraditionalRatio: policy.minimum_traditional_template_ratio,
    minimumReadableSizeRatio: policy.minimum_hero_or_standard_zone_ratio,
    maximumCompactRatio: 1 - policy.minimum_hero_or_standard_zone_ratio,
    maximumExternalLayoutRatio: policy.maximum_external_layout_ratio,
    maximumNonCoverRatio: 1 - policy.minimum_cover_frame_ratio,
    compactExceptions: new Set(policy.compact_text_exception_ids),
    externalLayoutExceptions: new Set(policy.external_layout_exception_ids),
    nonCoverExceptions: new Set(policy.non_cover_exception_ids)
  }
}

function metric(
  passing: number,
  total: number,
  threshold: number,
  emptyRatio: 0 | 1
): MemeReviewLayoutMetric {
  return {
    passing,
    total,
    ratio: total === 0 ? emptyRatio : passing / total,
    threshold
  }
}

function requireMinimum(
  label: string,
  metric: MemeReviewLayoutMetric,
  issues: string[]
) {
  if (metric.ratio + Number.EPSILON >= metric.threshold) return
  issues.push(
    `${label} are ${formatRatio(metric)}; expected at least ${formatPercent(metric.threshold)}`
  )
}

function requireMaximum(
  label: string,
  metric: MemeReviewLayoutMetric,
  issues: string[]
) {
  if (metric.ratio <= metric.threshold + Number.EPSILON) return
  issues.push(
    `${label} are ${formatRatio(metric)}; expected at most ${formatPercent(metric.threshold)}`
  )
}

function formatRatio(metric: MemeReviewLayoutMetric) {
  return `${metric.passing}/${metric.total} (${formatPercent(metric.ratio)})`
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

type IndexedIdea = {
  readonly scenarioSlug: string
  readonly idea: MemeIdeaV2
}

function indexIdeas(ideas: readonly ScenarioMemeIdeasV2[]) {
  return new Map(
    ideas.flatMap(({ scenario_slug, ideas: scenarioIdeas }) =>
      scenarioIdeas.map(
        (idea) => [idea.id, { scenarioSlug: scenario_slug, idea }] as const
      )
    )
  )
}

function uniquePlanMap<T extends { readonly id: string }>(
  values: readonly T[],
  label: string,
  issues: string[]
) {
  const result = new Map<string, T>()
  for (const value of values) {
    if (result.has(value.id)) {
      issues.push(`Generation plan repeats ${label} idea ${value.id}`)
    }
    result.set(value.id, value)
  }
  return result
}

function changedTopLevelFields(
  source: MemeIdeaV2,
  target: MemeIdeaV2
): string[] {
  const fields = new Set([...Object.keys(source), ...Object.keys(target)])
  return [...fields].filter(
    (field) =>
      !isDeepStrictEqual(
        source[field as keyof MemeIdeaV2],
        target[field as keyof MemeIdeaV2]
      )
  )
}

function reportSetDifference(
  ids: readonly string[],
  label: string,
  issues: string[]
) {
  if (ids.length)
    issues.push(`${label}${ids.length === 1 ? '' : 's'}: ${ids.join(', ')}`)
}
