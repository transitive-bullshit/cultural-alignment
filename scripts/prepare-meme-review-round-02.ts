import { join } from 'node:path'

import { contentCatalog } from '../lib/content/snapshot'
import {
  memeFeedbackDocumentV1Schema,
  memeIdeaCollectionV1Schema,
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  type MemeIdeaV1,
  type MemeReviewAsset
} from '../lib/meme-review/schema'
import {
  extractUrlContentHash,
  fileDigest,
  memeReviewRoundsPath,
  partition,
  readJson,
  writeJsonExclusiveOrVerify
} from './meme-review-round-utils'

const scenariosPerPart = 12
const roundOnePath = join(memeReviewRoundsPath, 'round-01')
const roundTwoPath = join(memeReviewRoundsPath, 'round-02')
const partsPath = join(roundTwoPath, 'parts')
const assetPartsPath = join(roundTwoPath, 'asset-parts')
const briefsPath = join(roundTwoPath, 'briefs')
const roundOneIdeasPath = join(roundOnePath, 'ideas.json')
const roundOneFeedbackPath = join(roundOnePath, 'feedback.json')

const [rawIdeas, rawFeedback, ideasDigest, feedbackDigest] = await Promise.all([
  readJson(roundOneIdeasPath),
  readJson(roundOneFeedbackPath),
  fileDigest(roundOneIdeasPath),
  fileDigest(roundOneFeedbackPath)
])
const roundOneIdeas = memeIdeaCollectionV1Schema.parse(rawIdeas)
const roundOneFeedback = memeFeedbackDocumentV1Schema.parse(rawFeedback)
const archivedIds = new Set(
  roundOneIdeas.flatMap(({ ideas }) => ideas.map(({ id }) => id))
)
const unexpectedFeedbackIds = Object.keys(roundOneFeedback.feedback).filter(
  (id) => !archivedIds.has(id)
)

if (unexpectedFeedbackIds.length) {
  throw new Error(
    `Round-one feedback references unknown ideas: ${unexpectedFeedbackIds.join(', ')}`
  )
}

const featuredSlugs = contentCatalog
  .listScenarioCards({ featuredOnly: true })
  .map(({ slug }) => slug)
const archivedSlugs = roundOneIdeas.map(({ scenario_slug }) => scenario_slug)

if (
  featuredSlugs.length !== archivedSlugs.length ||
  featuredSlugs.some((slug, index) => slug !== archivedSlugs[index])
) {
  throw new Error(
    'Featured scenario order has drifted from the immutable round-one archive'
  )
}

const allLikedIdeas = roundOneIdeas.flatMap(({ scenario_slug, ideas }) =>
  ideas
    .filter((idea) => feedbackFor(idea.id).rating === 'like')
    .map((idea) => ({ scenario_slug, idea }))
)
const allDislikedIdeas = roundOneIdeas.flatMap(({ scenario_slug, ideas }) =>
  ideas
    .filter((idea) => feedbackFor(idea.id).rating === 'dislike')
    .map((idea) => ({ scenario_slug, idea }))
)

const retainedScores = {
  scene_hinge: 4,
  ai_payoff: 4,
  parsing_ease: 4,
  visual_proof: 3,
  source_accuracy: 4
} as const

const placeholderScores = {
  scene_hinge: 1,
  ai_payoff: 1,
  parsing_ease: 1,
  visual_proof: 1,
  source_accuracy: 1
} as const

const preparedScenarios = roundOneIdeas.map((scenarioIdeas) => {
  const scenario = contentCatalog.getScenarioPage(scenarioIdeas.scenario_slug)
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioIdeas.scenario_slug}`)
  }

  const likedIdeas = scenarioIdeas.ideas.filter(
    (idea) => feedbackFor(idea.id).rating === 'like'
  )
  const replacementIdeas = scenarioIdeas.ideas.filter(
    (idea) => feedbackFor(idea.id).rating !== 'like'
  )
  const nextId = nextIdeaNumber(scenarioIdeas.ideas)
  const localDislike = scenarioIdeas.ideas.find(
    (idea) => feedbackFor(idea.id).rating === 'dislike'
  )
  const localLike = likedIdeas.at(0)

  const retained = likedIdeas.map((idea) => ({
    ...convertIdeaToV2(idea, `${scenario.slug}--curated`, {
      scores: retainedScores,
      closestLikedId: idea.id,
      contrastDislikedId:
        localDislike?.id ?? findConceptMatch(allDislikedIdeas, idea)?.id ?? null
    }),
    round2_generation: {
      status: 'retained-like',
      round_1_id: idea.id,
      round_1_rating: 'like',
      round_1_notes: feedbackFor(idea.id).notes
    }
  }))
  const replacements = replacementIdeas.map((idea, replacementIndex) => {
    const replacementId = `${scenario.slug}--${String(nextId + replacementIndex).padStart(2, '0')}`
    const roundOneResult = feedbackFor(idea.id)

    return {
      ...convertIdeaToV2(idea, `${scenario.slug}--curated`, {
        id: replacementId,
        scores: placeholderScores,
        closestLikedId:
          localLike?.id ?? findConceptMatch(allLikedIdeas, idea)?.id ?? null,
        contrastDislikedId:
          roundOneResult.rating === 'dislike'
            ? idea.id
            : (localDislike?.id ??
              findConceptMatch(allDislikedIdeas, idea)?.id ??
              null),
        placeholder: true,
        roundOneRating: roundOneResult.rating
      }),
      round2_generation: {
        status: 'replace',
        replaces_round_1_id: idea.id,
        round_1_rating: roundOneResult.rating,
        round_1_notes: roundOneResult.notes,
        instruction:
          'GENERATOR MUST REPLACE this seeded direction, copy, layout, frame guidance, and critique with a genuinely new round-two candidate.'
      }
    }
  })

  if (retained.length + replacements.length !== 3) {
    throw new Error(
      `${scenario.slug} must seed exactly three round-two slots; found ${retained.length + replacements.length}`
    )
  }

  const asset = curatedAssetForScenario(scenario)

  return {
    scenario: {
      scenario_slug: scenario.slug,
      ideas: [...retained, ...replacements]
    },
    asset,
    brief: {
      scenario_slug: scenario.slug,
      title: scenario.title,
      source: {
        slug: scenario.source.slug,
        title: scenario.source.title
      },
      episode_label: scenario.episode?.label ?? null,
      scene: scenario.scene,
      analogy: scenario.whyAnalogyWorks,
      caveats: scenario.caveats,
      concept_titles: scenario.concepts.map(({ title }) => title),
      curated_asset_id: asset.id,
      asset_annotation_required: true,
      retainedLikedIds: likedIdeas.map(({ id }) => id),
      replacementSlots: replacementIdeas.map((idea, replacementIndex) => ({
        old_id: idea.id,
        new_id: `${scenario.slug}--${String(nextId + replacementIndex).padStart(2, '0')}`,
        rating: feedbackFor(idea.id).rating,
        note: feedbackFor(idea.id).notes
      }))
    }
  }
})

const preparedParts = partition(preparedScenarios, scenariosPerPart)
const seededIdeaCollection = preparedScenarios.map(({ scenario }) => scenario)
const seededAssetCollection = preparedScenarios.map(({ asset }) => asset)
memeIdeaCollectionV2Schema.parse(seededIdeaCollection)
memeReviewAssetCollectionSchema.parse(seededAssetCollection)

const writeResults: ('created' | 'verified')[] = []

for (const [index, part] of preparedParts.entries()) {
  const partName = `part-${String(index + 1).padStart(2, '0')}`
  writeResults.push(
    await writeJsonExclusiveOrVerify(
      join(partsPath, `${partName}.json`),
      part.map(({ scenario }) => scenario)
    ),
    await writeJsonExclusiveOrVerify(
      join(assetPartsPath, `${partName}.json`),
      part.map(({ asset }) => asset)
    ),
    await writeJsonExclusiveOrVerify(join(briefsPath, `${partName}.json`), {
      version: 1,
      round: 2,
      part: partName,
      instructions: {
        retained:
          'Keep stable IDs plus the approved copy, AI concept, and native format for liked ideas. Recompose every preview as needed; revise copy only when the written feedback explicitly requests it.',
        replacements:
          'Every replacement slot is seeded from a non-liked round-one idea only to keep the files schema-valid. Replace it with a genuinely new direction and retain the allocated new ID.',
        assets:
          'Inspect the curated frame, annotate faces and recognition-critical subjects/props in the matching asset part, and place text outside must-protect regions.'
      },
      scenarios: part.map(({ brief }) => brief)
    })
  )
}

const retainedCount = allLikedIdeas.length
const replacementCount = seededIdeaCollection.reduce(
  (count, { ideas }) =>
    count +
    ideas.filter((idea) => idea.round2_generation.status === 'replace').length,
  0
)

writeResults.push(
  await writeJsonExclusiveOrVerify(join(roundTwoPath, 'generation-plan.json'), {
    version: 1,
    round: 2,
    source_archive: {
      ideas_sha256: ideasDigest.sha256,
      feedback_sha256: feedbackDigest.sha256
    },
    scenarios: preparedScenarios.length,
    target_ideas: retainedCount + replacementCount,
    retained_likes: retainedCount,
    replacement_slots: replacementCount,
    parts: preparedParts.map((part, index) => ({
      part: `part-${String(index + 1).padStart(2, '0')}`,
      scenarios: part.length,
      retained_likes: part.reduce(
        (count, { brief }) => count + brief.retainedLikedIds.length,
        0
      ),
      replacement_slots: part.reduce(
        (count, { brief }) => count + brief.replacementSlots.length,
        0
      )
    }))
  })
)

console.log(
  `${writeResults.filter((result) => result === 'created').length ? 'Prepared' : 'Verified'} ${preparedScenarios.length} scenarios in ${preparedParts.length} parts: ${retainedCount} retained likes and ${replacementCount} mandatory replacement slots.`
)

function feedbackFor(id: string) {
  return (
    roundOneFeedback.feedback[id] ?? {
      rating: null,
      notes: '',
      locked: false,
      lockRevision: 0
    }
  )
}

function nextIdeaNumber(ideas: readonly MemeIdeaV1[]): number {
  const maximum = Math.max(
    ...ideas.map(({ id }) => Number(id.match(/--(\d+)$/)?.[1]))
  )
  return maximum + 1
}

function findConceptMatch(
  candidates: readonly { scenario_slug: string; idea: MemeIdeaV1 }[],
  idea: MemeIdeaV1
): MemeIdeaV1 | null {
  return (
    candidates.find(
      (candidate) => candidate.idea.ai_concept === idea.ai_concept
    )?.idea ??
    candidates.at(0)?.idea ??
    null
  )
}

function convertIdeaToV2(
  idea: MemeIdeaV1,
  assetId: string,
  options: {
    readonly id?: string
    readonly scores: typeof retainedScores | typeof placeholderScores
    readonly closestLikedId: string | null
    readonly contrastDislikedId: string | null
    readonly placeholder?: boolean
    readonly roundOneRating?: 'dislike' | 'neutral' | 'like' | null
  }
) {
  const preview = convertPreview(idea, assetId)
  const placeholderLabel = options.roundOneRating ?? 'unrated'
  const baseCritic = {
    ...idea.critic,
    scores: options.scores,
    calibration: {
      closest_liked_id: options.closestLikedId,
      contrast_disliked_id: options.contrastDislikedId
    }
  }
  const critic = options.placeholder
    ? {
        ...baseCritic,
        verdict: 'revise' as const,
        predicted_rating: 'neutral' as const,
        confidence: 0,
        expected_feedback: `GENERATION PLACEHOLDER seeded from a round-one ${placeholderLabel} direction; replace before editorial review.`,
        strongest_quality:
          'The archived direction remains only as context for what this allocated slot must improve upon.',
        main_risk:
          'This is not a new round-two meme idea; the generator must replace the concept, copy, composition, and critique.'
      }
    : baseCritic

  return {
    ...idea,
    id: options.id ?? idea.id,
    preview,
    critic
  }
}

function convertPreview(idea: MemeIdeaV1, assetId: string) {
  const lineIndexes = idea.caption_lines.map((_, index) => index)
  const style =
    idea.format === 'dialogue'
      ? ('dialogue' as const)
      : idea.format === 'source-native interface'
        ? ('status' as const)
        : idea.format === 'relabel'
          ? ('label' as const)
          : ('impact' as const)

  if (idea.preview.layout === 'top') {
    return previewWithZones('band-top', assetId, [
      zone(lineIndexes, 'top', style)
    ])
  }

  if (idea.preview.layout === 'bottom') {
    return previewWithZones('band-bottom', assetId, [
      zone(lineIndexes, 'bottom', style)
    ])
  }

  if (idea.preview.layout === 'dialogue') {
    return previewWithZones(
      'dialogue',
      assetId,
      lineIndexes.map((line, index) =>
        zone(
          [line],
          index % 2 === 0 ? 'bottom-left' : 'bottom-right',
          'dialogue',
          index % 2 === 0 ? 'left' : 'right'
        )
      )
    )
  }

  if (idea.preview.layout === 'interface') {
    return previewWithZones('interface', assetId, [
      zone(lineIndexes, 'full', 'status', 'left')
    ])
  }

  const splitAt = Math.max(1, Math.ceil(lineIndexes.length / 2))
  const firstLines = lineIndexes.slice(0, splitAt)
  const secondLines = lineIndexes.slice(splitAt)
  const [firstSlot, secondSlot] =
    idea.preview.layout === 'split'
      ? (['panel-left', 'panel-right'] as const)
      : idea.preview.layout === 'label'
        ? (['top-left', 'bottom-right'] as const)
        : (['top', 'bottom'] as const)
  const zones = [zone(firstLines, firstSlot, style)]
  if (secondLines.length) zones.push(zone(secondLines, secondSlot, style))

  return previewWithZones('overlay', assetId, zones)
}

type PreviewTemplate =
  | 'overlay'
  | 'band-top'
  | 'band-bottom'
  | 'dialogue'
  | 'interface'

type PreviewStyle = 'impact' | 'dialogue' | 'label' | 'status'
type PreviewSlot =
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'bottom-left'
  | 'bottom-right'
  | 'panel-left'
  | 'panel-right'
  | 'full'

function previewWithZones(
  template: PreviewTemplate,
  assetId: string,
  zones: ReturnType<typeof zone>[]
) {
  return {
    renderer: 2 as const,
    template,
    frame_mode: 'contain-blur' as const,
    asset_ids: [assetId],
    zones
  }
}

function zone(
  lines: number[],
  slot: PreviewSlot,
  style: PreviewStyle,
  align: 'left' | 'center' | 'right' = 'center'
) {
  return {
    lines,
    slot,
    style,
    align,
    casing: 'preserve' as const,
    size: lines.length > 2 ? ('compact' as const) : ('standard' as const),
    indent_levels: lines.map(() => 0)
  }
}

function curatedAssetForScenario(
  scenario: NonNullable<ReturnType<typeof contentCatalog.getScenarioPage>>
): MemeReviewAsset & { annotation_status: 'needed' } {
  const contentHash = extractUrlContentHash(scenario.image.gallerySrc)
  if (!contentHash) {
    throw new Error(
      `Curated image URL has no embedded SHA-256 for ${scenario.slug}: ${scenario.image.gallerySrc}`
    )
  }

  return {
    id: `${scenario.slug}--curated`,
    scenario_slug: scenario.slug,
    src: scenario.image.gallerySrc,
    width: scenario.image.width,
    height: scenario.image.height,
    alt: scenario.image.alt,
    blur_data_url: scenario.image.blurDataURL,
    content_hash: contentHash,
    protected_regions: [
      {
        id: `${scenario.slug}--primary-composition-area`,
        label: 'Primary composition area (conservative seed; verify visually)',
        kind: 'subject',
        priority: 'soft',
        source_rect: [15, 10, 70, 80]
      }
    ],
    annotation_status: 'needed'
  }
}
