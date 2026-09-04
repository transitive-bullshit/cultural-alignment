import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewBatchStatusSchema,
  memeReviewStateDocumentSchema,
  type ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import {
  assertValidMemeReviewBatch,
  type MemeReviewValidationPlan
} from './meme-review-batch-validator'
import {
  memeReviewRoundsPath,
  parseNamedArgument,
  sha256
} from './meme-review-round-utils'

const roundName = parseNamedArgument('round')
if (!roundName || !/^round-\d{2,}$/.test(roundName)) {
  throw new Error(
    'Choose an explicit target batch, for example --round=round-03'
  )
}

const roundNumber = Number(roundName.slice('round-'.length))
const roundPath = join(memeReviewRoundsPath, roundName)
const plan = parseGenerationPlan(
  JSON.parse(await readFile(join(roundPath, 'generation-plan.json'), 'utf8'))
)
if (plan.target_batch !== roundNumber) {
  throw new Error(
    `${roundName}/generation-plan.json targets Batch ${plan.target_batch}`
  )
}

const sourceName = `round-${String(plan.source_batch).padStart(2, '0')}`
const sourcePath = join(memeReviewRoundsPath, sourceName)
const sourceFileNames = [
  'ideas.json',
  'assets.json',
  'feedback.json',
  'status.json'
] as const
const sourceTexts = Object.fromEntries(
  await Promise.all(
    sourceFileNames.map(async (name) => [
      name,
      await readFile(join(sourcePath, name), 'utf8')
    ])
  )
) as Record<(typeof sourceFileNames)[number], string>

for (const name of sourceFileNames) {
  const expected = plan.source_files[name]
  const actualBytes = Buffer.byteLength(sourceTexts[name])
  const actualHash = sha256(sourceTexts[name])
  if (actualBytes !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(
      `${sourceName}/${name} changed after Batch ${roundNumber} was planned`
    )
  }
}

const [rawTargetIdeas, rawTargetAssets, rawTargetFeedback, rawTargetStatus] =
  await Promise.all([
    readJson(join(roundPath, 'ideas.json')),
    readJson(join(roundPath, 'assets.json')),
    readJson(join(roundPath, 'feedback.json')),
    readJson(join(roundPath, 'status.json'))
  ])
const sourceIdeas = memeIdeaCollectionV2Schema.parse(
  JSON.parse(sourceTexts['ideas.json'])
)
const sourceAssets = memeReviewAssetCollectionSchema.parse(
  JSON.parse(sourceTexts['assets.json'])
)
const sourceFeedback = memeReviewStateDocumentSchema.parse(
  JSON.parse(sourceTexts['feedback.json'])
)
const baseTargetIdeas = memeIdeaCollectionV2Schema.parse(rawTargetIdeas)
const baseTargetAssets = memeReviewAssetCollectionSchema.parse(rawTargetAssets)
const targetFeedback = memeReviewStateDocumentSchema.parse(rawTargetFeedback)
const targetStatus = memeReviewBatchStatusSchema.parse(rawTargetStatus)

if (targetStatus.batch !== roundNumber) {
  throw new Error(
    `${roundName}/status.json identifies Batch ${targetStatus.batch}`
  )
}

const selectedParts = selectParts(plan)
const selectedPartNames = new Set(selectedParts.map(({ part }) => part))
const selectedScenarioSlugs = new Set(
  selectedParts.flatMap(({ scenario_slugs }) => scenario_slugs)
)
const selectedIdeaIds = new Set(
  selectedParts.flatMap(({ idea_ids }) => idea_ids)
)
const partPayloads = await Promise.all(
  selectedParts.map(async (descriptor) => {
    const [rawIdeas, rawAssets] = await Promise.all([
      readJson(join(roundPath, 'parts', `${descriptor.part}.json`)),
      readJson(join(roundPath, 'asset-parts', `${descriptor.part}.json`))
    ])
    const ideas = memeIdeaCollectionV2Schema.parse(rawIdeas)
    const assets = memeReviewAssetCollectionSchema.parse(rawAssets)
    validatePartDescriptor(descriptor, ideas)
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
const targetIdeas = baseTargetIdeas.map(
  (scenario) => replacementIdeasBySlug.get(scenario.scenario_slug) ?? scenario
)
const targetAssets = [
  ...baseTargetAssets.filter(
    ({ scenario_slug }) => !selectedScenarioSlugs.has(scenario_slug)
  ),
  ...replacementAssets
]

const report = assertValidMemeReviewBatch({
  sourceIdeas,
  sourceAssets,
  sourceFeedback,
  targetIdeas,
  targetAssets,
  targetFeedback,
  plan,
  metricIdeaIds: selectedIdeaIds
})

console.log(
  JSON.stringify(
    {
      round: roundName,
      parts: [...selectedPartNames],
      metrics: report.metrics
    },
    null,
    2
  )
)

function selectParts(plan: MemeReviewValidationPlan) {
  const requested = parseNamedArgument('parts') ?? 'all'
  if (requested === 'all') return plan.parts

  const names = requested
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => (name.startsWith('part-') ? name : `part-${name}`))
  if (!names.length || names.some((name) => !/^part-\d{2}$/.test(name))) {
    throw new Error('Choose parts such as --parts=01,02 or --parts=all')
  }

  const descriptorsByName = new Map(
    plan.parts.map((descriptor) => [descriptor.part, descriptor])
  )
  return names.map((name) => {
    const descriptor = descriptorsByName.get(name)
    if (!descriptor) throw new Error(`${name} is not in the generation plan`)
    return descriptor
  })
}

function validatePartDescriptor(
  descriptor: MemeReviewValidationPlan['parts'][number],
  ideas: readonly ScenarioMemeIdeasV2[]
) {
  const actualScenarioSlugs = ideas.map(({ scenario_slug }) => scenario_slug)
  const actualIdeaIds = ideas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
  if (!sameSet(actualScenarioSlugs, descriptor.scenario_slugs)) {
    throw new Error(`${descriptor.part} scenario set differs from its plan`)
  }
  if (!sameSet(actualIdeaIds, descriptor.idea_ids)) {
    throw new Error(`${descriptor.part} idea set differs from its plan`)
  }
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  )
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

function parseGenerationPlan(value: unknown): MemeReviewValidationPlan {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !['layout-refinement', 'punctuation-refinement'].includes(
      String(value.mode)
    ) ||
    !Number.isInteger(value.source_batch) ||
    !Number.isInteger(value.target_batch) ||
    !isRecord(value.source_files) ||
    !isRecord(value.counts) ||
    !Array.isArray(value.ideas) ||
    !Array.isArray(value.dropped_ideas) ||
    !Array.isArray(value.parts) ||
    !Array.isArray(value.asset_revision_idea_ids) ||
    !isRecord(value.layout_policy)
  ) {
    throw new Error('Malformed meme review generation plan')
  }
  return value as MemeReviewValidationPlan
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
