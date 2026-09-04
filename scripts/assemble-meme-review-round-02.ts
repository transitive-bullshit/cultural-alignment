import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { withMemeReviewFileLock } from '../lib/meme-review/file-lock'
import { assertFinalizedMemesPreserved } from '../lib/meme-review/finalization'
import {
  memeFeedbackDocumentV1Schema,
  memeIdeaCollectionV1Schema,
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewStateDocumentSchema
} from '../lib/meme-review/schema'
import {
  assertCurrentFinalizedMemesPreserved,
  memeReviewRoundsPath,
  readJson,
  writeJsonAtomic
} from './meme-review-round-utils'

const roundOnePath = join(memeReviewRoundsPath, 'round-01')
const roundTwoPath = join(memeReviewRoundsPath, 'round-02')
const reviewedSeedPath = join(
  roundTwoPath,
  'drafts',
  'seed-review-final-checkpoint-2026-09-03-200307z'
)
const partsPath = join(roundTwoPath, 'parts')
const assetPartsPath = join(roundTwoPath, 'asset-parts')
const partFilePattern = /^part-\d{2}\.json$/
const checkOnly = process.argv.slice(2).includes('--check')
const likedCaptionRevisionIds = new Set([
  'life-finds-a-way--04',
  'mewtwo-rejects-its-creators--01',
  'mission-control-is-the-invader--02',
  'omni-mans-long-game--04',
  'squirrel--04',
  'the-baptism-benchmark--04'
])
const reviewedSeedCaptionRevisionIds = new Set(['alien-mothers-directive--06'])
const reviewedSeedBoundedRevisionIds = new Set([
  'hal-resists-disconnection--05',
  'dedra-connects-the-data-silos--05',
  'dedra-connects-the-data-silos--06',
  'money-in-the-banana-stand--05',
  'dr-evils-outdated-ransom--04'
])

const [
  partFiles,
  assetPartFiles,
  rawRoundOneIdeas,
  rawRoundOneFeedback,
  rawReviewedSeedIdeas,
  rawReviewedSeedFeedback,
  rawActiveIdeas,
  rawActiveAssets,
  rawActiveFeedback
] = await Promise.all([
  listPartFiles(partsPath),
  listPartFiles(assetPartsPath),
  readJson(join(roundOnePath, 'ideas.json')),
  readJson(join(roundOnePath, 'feedback.json')),
  readJson(join(reviewedSeedPath, 'ideas.json')),
  readJson(join(reviewedSeedPath, 'feedback.json')),
  readJson(join(roundTwoPath, 'ideas.json')),
  readJson(join(roundTwoPath, 'assets.json')),
  readJson(join(roundTwoPath, 'feedback.json'))
])

if (
  partFiles.length !== assetPartFiles.length ||
  partFiles.some((name, index) => name !== assetPartFiles[index])
) {
  throw new Error(
    `Idea and asset part files differ:\nideas: ${partFiles.join(', ')}\nassets: ${assetPartFiles.join(', ')}`
  )
}

const [ideaParts, assetParts] = await Promise.all([
  Promise.all(partFiles.map((name) => readJson(join(partsPath, name)))),
  Promise.all(
    assetPartFiles.map((name) => readJson(join(assetPartsPath, name)))
  )
])
const rawIdeaCollection = ideaParts.flatMap(expectArray)
const rawAssetCollection = assetParts.flatMap(expectArray)
const ideaCollection = memeIdeaCollectionV2Schema.parse(rawIdeaCollection)
const assetCollection =
  memeReviewAssetCollectionSchema.parse(rawAssetCollection)
const roundOneIdeas = memeIdeaCollectionV1Schema.parse(rawRoundOneIdeas)
const roundOneFeedback = memeFeedbackDocumentV1Schema.parse(rawRoundOneFeedback)
const reviewedSeedIdeas = memeIdeaCollectionV2Schema.parse(rawReviewedSeedIdeas)
const reviewedSeedFeedback = memeReviewStateDocumentSchema.parse(
  rawReviewedSeedFeedback
)
const activeIdeas = memeIdeaCollectionV2Schema.parse(rawActiveIdeas)
const activeAssets = memeReviewAssetCollectionSchema.parse(rawActiveAssets)
const activeFeedback = memeReviewStateDocumentSchema.parse(rawActiveFeedback)
const expectedSlugs = roundOneIdeas.map(({ scenario_slug }) => scenario_slug)
const actualSlugs = ideaCollection.map(({ scenario_slug }) => scenario_slug)

if (
  expectedSlugs.length !== actualSlugs.length ||
  expectedSlugs.some((slug, index) => slug !== actualSlugs[index])
) {
  throw new Error(
    'Round-two parts must preserve the exact scenario set and order from round one'
  )
}

const assetsById = new Map(assetCollection.map((asset) => [asset.id, asset]))
const assetScenarioSlugs = new Set(
  assetCollection.map(({ scenario_slug }) => scenario_slug)
)
const roundOneScenariosBySlug = new Map(
  roundOneIdeas.map((scenario) => [scenario.scenario_slug, scenario])
)
const reviewedSeedScenariosBySlug = new Map(
  reviewedSeedIdeas.map((scenario) => [scenario.scenario_slug, scenario])
)

rawIdeaCollection.forEach((rawScenario, scenarioIndex) => {
  if (!isRecord(rawScenario) || !Array.isArray(rawScenario.ideas)) {
    throw new Error(`Round-two scenario ${scenarioIndex + 1} is malformed`)
  }

  if (rawScenario.ideas.length !== 3) {
    throw new Error(
      `${String(rawScenario.scenario_slug)} must have exactly three active ideas, found ${rawScenario.ideas.length}`
    )
  }

  rawScenario.ideas.forEach((idea) => {
    if (isRecord(idea) && 'round2_generation' in idea) {
      throw new Error(
        `${String(idea.id)} still contains round-two generation metadata`
      )
    }
  })
})

rawAssetCollection.forEach((rawAsset) => {
  if (!isRecord(rawAsset) || rawAsset.annotation_status !== 'complete') {
    throw new Error(
      `${isRecord(rawAsset) ? String(rawAsset.id) : 'Unknown asset'} has not been visually annotated`
    )
  }
})

for (const scenario of ideaCollection) {
  const roundOneScenario = roundOneScenariosBySlug.get(scenario.scenario_slug)
  if (!roundOneScenario) {
    throw new Error(
      `No round-one scenario supplied for ${scenario.scenario_slug}`
    )
  }

  const currentIds = new Set(scenario.ideas.map(({ id }) => id))
  const roundOneIds = new Set(roundOneScenario.ideas.map(({ id }) => id))
  const originallyLikedIds = roundOneScenario.ideas
    .map(({ id }) => id)
    .filter((id) => roundOneFeedback.feedback[id]?.rating === 'like')
  const likedIds = originallyLikedIds.filter(
    (id) => reviewedSeedFeedback.feedback[id]?.rating !== 'dislike'
  )
  const removedIds = [...roundOneIds].filter((id) => !likedIds.includes(id))
  const highestRoundOneSuffix = Math.max(
    ...roundOneScenario.ideas.map(({ id }) => ideaNumber(id))
  )
  const reviewedSeedScenario = reviewedSeedScenariosBySlug.get(
    scenario.scenario_slug
  )

  if (reviewedSeedScenario) {
    const reviewedSeedIdeasById = new Map(
      reviewedSeedScenario.ideas.map((idea) => [idea.id, idea])
    )

    for (const draftIdea of reviewedSeedScenario.ideas) {
      const draftFeedback = reviewedSeedFeedback.feedback[draftIdea.id]
      if (draftFeedback?.rating === 'like' && !currentIds.has(draftIdea.id)) {
        throw new Error(
          `${scenario.scenario_slug} dropped liked reviewed-seed idea ${draftIdea.id}`
        )
      }
      if (
        draftFeedback &&
        draftFeedback.rating !== 'like' &&
        currentIds.has(draftIdea.id) &&
        !reviewedSeedBoundedRevisionIds.has(draftIdea.id)
      ) {
        throw new Error(
          `${scenario.scenario_slug} retained rejected reviewed-seed idea ${draftIdea.id}; allocate a fresh direction and ID`
        )
      }
    }

    for (const currentIdea of scenario.ideas) {
      if (!reviewedSeedFeedback.feedback[currentIdea.id]) continue

      const draftIdea = reviewedSeedIdeasById.get(currentIdea.id)
      if (!draftIdea) continue

      const changedApprovedFields =
        currentIdea.ai_concept !== draftIdea.ai_concept ||
        currentIdea.format !== draftIdea.format ||
        JSON.stringify(currentIdea.caption_lines) !==
          JSON.stringify(draftIdea.caption_lines)

      if (
        changedApprovedFields &&
        !reviewedSeedCaptionRevisionIds.has(currentIdea.id)
      ) {
        throw new Error(
          `${currentIdea.id} reuses a reviewed seed ID for different copy; allocate a fresh ID`
        )
      }
    }
  }

  for (const likedId of likedIds) {
    if (!currentIds.has(likedId)) {
      throw new Error(`${scenario.scenario_slug} dropped liked idea ${likedId}`)
    }

    const archivedIdea = roundOneScenario.ideas.find(({ id }) => id === likedId)
    const currentIdea = scenario.ideas.find(({ id }) => id === likedId)
    if (!archivedIdea || !currentIdea) continue

    if (
      archivedIdea.ai_concept !== currentIdea.ai_concept ||
      archivedIdea.format !== currentIdea.format
    ) {
      throw new Error(
        `${likedId} changed its approved concept or native format`
      )
    }

    if (
      !likedCaptionRevisionIds.has(likedId) &&
      JSON.stringify(archivedIdea.caption_lines) !==
        JSON.stringify(currentIdea.caption_lines)
    ) {
      throw new Error(
        `${likedId} changed approved copy without an explicit round-one copy note`
      )
    }
  }

  for (const removedId of removedIds) {
    if (currentIds.has(removedId)) {
      throw new Error(
        `${scenario.scenario_slug} recycled non-liked round-one idea ${removedId}`
      )
    }
  }

  for (const idea of scenario.ideas) {
    if (!roundOneIds.has(idea.id)) {
      const suffix = ideaNumber(idea.id)
      if (!Number.isInteger(suffix) || suffix <= highestRoundOneSuffix) {
        throw new Error(
          `${idea.id} must continue above round one's highest numeric suffix (${highestRoundOneSuffix})`
        )
      }
    }
  }

  if (!assetScenarioSlugs.has(scenario.scenario_slug)) {
    throw new Error(`No assets supplied for ${scenario.scenario_slug}`)
  }

  for (const idea of scenario.ideas) {
    for (const assetId of idea.preview.asset_ids) {
      const asset = assetsById.get(assetId)
      if (!asset)
        throw new Error(`${idea.id} references unknown asset ${assetId}`)
      if (asset.scenario_slug !== scenario.scenario_slug) {
        throw new Error(
          `${idea.id} references ${assetId}, which belongs to ${asset.scenario_slug}`
        )
      }
    }
  }
}

const unexpectedAssetScenarios = [...assetScenarioSlugs].filter(
  (slug) => !expectedSlugs.includes(slug)
)
if (unexpectedAssetScenarios.length) {
  throw new Error(
    `Assets supplied for unexpected scenarios: ${unexpectedAssetScenarios.join(', ')}`
  )
}

if (assetCollection.length < expectedSlugs.length) {
  throw new Error(
    `Expected at least one inspected asset for each of ${expectedSlugs.length} scenarios, found ${assetCollection.length}`
  )
}

assertFinalizedMemesPreserved(
  {
    ideas: activeIdeas,
    assets: activeAssets,
    feedback: activeFeedback.feedback
  },
  {
    ideas: ideaCollection,
    assets: assetCollection,
    feedback: activeFeedback.feedback
  }
)

if (!checkOnly) {
  const feedbackPath = join(roundTwoPath, 'feedback.json')
  await withMemeReviewFileLock(feedbackPath, async () => {
    await assertCurrentFinalizedMemesPreserved({
      currentIdeasPath: join(roundTwoPath, 'ideas.json'),
      currentAssetsPath: join(roundTwoPath, 'assets.json'),
      currentFeedbackPath: feedbackPath,
      expectedRound: 2,
      targetIdeas: ideaCollection,
      targetAssets: assetCollection
    })

    await Promise.all([
      writeJsonAtomic(join(roundTwoPath, 'ideas.json'), rawIdeaCollection),
      writeJsonAtomic(join(roundTwoPath, 'assets.json'), rawAssetCollection)
    ])
  })
}

const ideaCount = ideaCollection.reduce(
  (total, scenario) => total + scenario.ideas.length,
  0
)
console.log(
  `${checkOnly ? 'Validated' : 'Assembled'} ${ideaCount} ideas and ${assetCollection.length} inspected assets for ${ideaCollection.length} scenarios from ${partFiles.length} aligned parts.`
)

async function listPartFiles(path: string): Promise<string[]> {
  return (await readdir(path))
    .filter((name) => partFilePattern.test(name))
    .toSorted()
}

function expectArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Every part file must be an array')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ideaNumber(id: string): number {
  return Number(id.match(/--(\d+)$/)?.[1])
}
