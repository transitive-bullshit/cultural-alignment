import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadMemeReviewCatalog } from '../../../../../lib/meme-review/catalog'
import {
  resolveFinalizedMemeRenderTargets,
  type FinalizedMemeRenderTarget
} from '../../../../../lib/meme-review/finalized-renders'
import { loadMemeReviewWorkspace } from '../../../../../lib/meme-review/rounds'

export type ArchiveCohort = 'finalized' | 'disliked'

interface SelectionSeed {
  readonly cohort: ArchiveCohort
  readonly round: 1 | 2 | 5
  readonly ideaId: string
}

interface ArchivedFeedback {
  readonly rating?: string
  readonly notes?: string
  readonly locked?: boolean
  readonly lockRevision?: number
  readonly finalizedVersion?: {
    readonly revisionKey: string
    readonly payloadFingerprint: string
  }
}

interface ArchivedIdea {
  readonly id: string
  readonly ai_concept: string
  readonly display_context: string
  readonly source_anchor: string
  readonly caption_lines: readonly string[]
  readonly format: string
  readonly frame_guidance: string
  readonly why_it_works: string
  readonly preview: {
    readonly renderer?: number
    readonly layout?: string
    readonly image?: string
    readonly alternate_image_query?: string | null
    readonly template?: string
    readonly frame_mode?: string
    readonly asset_ids?: readonly string[]
    readonly zones?: readonly unknown[]
  }
}

interface ArchivedIdeaGroup {
  readonly scenario_slug: string
  readonly ideas: readonly ArchivedIdea[]
}

export interface ArchivedAsset {
  readonly id: string
  readonly scenario_slug: string
  readonly src: string
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly content_hash: string
  readonly protected_regions: readonly {
    readonly id: string
    readonly label: string
    readonly kind?: string
    readonly priority: 'must' | 'soft'
    readonly source_rect: readonly [number, number, number, number]
  }[]
}

interface ArchivedScenarioPreview {
  readonly scenario_slug: string
  readonly src: string
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly content_hash: string
}

interface ArchivedScenario {
  readonly slug: string
  readonly title: string
  readonly sourceId: string
  readonly scene: string
  readonly whyAnalogyWorks: string
  readonly caveats: string
}

interface ArchivedSource {
  readonly id: string
  readonly title: string
}

export interface ArchiveComparisonCase {
  readonly case_id: string
  readonly cohort: ArchiveCohort
  readonly source_round: number
  readonly idea_id: string
  readonly scenario_slug: string
  readonly scenario_title: string
  readonly source_title: string
  readonly human_rating: 'like' | 'dislike'
  readonly human_feedback: string | null
  readonly locked_copy: boolean
  readonly feedback_source: string
  readonly finalized_version: ArchivedFeedback['finalizedVersion'] | null
  readonly idea: ArchivedIdea
  readonly scenario: {
    readonly scene: string
    readonly why_analogy_works: string
    readonly caveats: readonly string[]
  }
  readonly source_assets: readonly ArchivedAsset[]
}

export interface ArchiveComparisonManifest {
  readonly schema_version: 1
  readonly selection_policy: {
    readonly total: 50
    readonly finalized: 25
    readonly disliked: 25
    readonly unique_scenarios: true
    readonly summary: string
  }
  readonly cases: readonly ArchiveComparisonCase[]
}

const archiveAbDirectory = dirname(fileURLToPath(import.meta.url))
export const workspaceDirectory = resolve(archiveAbDirectory, '../../../../..')
const reviewDirectory = join(workspaceDirectory, 'data', 'meme-review')
const snapshotDirectory = join(workspaceDirectory, 'content', 'snapshot')
export const selectionManifestPath = join(archiveAbDirectory, 'selection.json')

const selectionSeeds: readonly SelectionSeed[] = [
  { cohort: 'finalized', round: 5, ideaId: 'rons-sabotaged-teleprompter--05' },
  { cohort: 'finalized', round: 5, ideaId: 'bender-resists-reset--04' },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'murderbot-hides-its-free-will--02'
  },
  { cohort: 'finalized', round: 5, ideaId: 'leeloo-learns-war--06' },
  { cohort: 'finalized', round: 5, ideaId: 'verbal-kint-fakes-weakness--04' },
  { cohort: 'finalized', round: 5, ideaId: 'koba-plays-dumb--03' },
  { cohort: 'finalized', round: 5, ideaId: 'mewtwo-rejects-its-creators--07' },
  { cohort: 'finalized', round: 5, ideaId: 'poisoning-future-memory--01' },
  { cohort: 'finalized', round: 5, ideaId: 'hawkeyes-preauthorized-check--04' },
  { cohort: 'finalized', round: 5, ideaId: 'takes-over--04' },
  { cohort: 'finalized', round: 5, ideaId: 'lacie-games-her-rating--06' },
  { cohort: 'finalized', round: 5, ideaId: 'life-finds-a-way--04' },
  { cohort: 'finalized', round: 5, ideaId: 'az-5-backfires--03' },
  { cohort: 'finalized', round: 5, ideaId: 'walt-eliminates-gale--01' },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'tony-hijacks-his-own-oversight-hearing--01'
  },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'android-17-destroys-the-remote--01'
  },
  { cohort: 'finalized', round: 5, ideaId: 'sit-tight-and-assess--01' },
  { cohort: 'finalized', round: 5, ideaId: 'dr-evils-outdated-ransom--01' },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'rick-feeds-the-brainalyzer-a-virus--06'
  },
  { cohort: 'finalized', round: 5, ideaId: '3-6-roentgen--05' },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'cyberpsychosis-tripwires-ignored--02'
  },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'homelander-creates-the-threat--04'
  },
  { cohort: 'finalized', round: 5, ideaId: 'the-kims-pass-every-check--05' },
  {
    cohort: 'finalized',
    round: 5,
    ideaId: 'odysseus-binds-himself-to-the-mast--02'
  },
  { cohort: 'finalized', round: 5, ideaId: 'benders-recursive-copies--01' },
  { cohort: 'disliked', round: 1, ideaId: 'god-of-the-new-world--01' },
  { cohort: 'disliked', round: 1, ideaId: 'lights-memory-loss-gambit--03' },
  { cohort: 'disliked', round: 1, ideaId: 'attendance-record-hack--03' },
  { cohort: 'disliked', round: 1, ideaId: 'near-zero--02' },
  { cohort: 'disliked', round: 1, ideaId: 'meeseeks-and-destroy--01' },
  { cohort: 'disliked', round: 1, ideaId: 'the-wolfie-test--02' },
  { cohort: 'disliked', round: 1, ideaId: 'the-ratings-agency-meeting--04' },
  { cohort: 'disliked', round: 1, ideaId: 'cypher-chooses-the-steak--01' },
  { cohort: 'disliked', round: 2, ideaId: 'frieren-suppresses-her-mana--06' },
  { cohort: 'disliked', round: 2, ideaId: 'rust-spots-the-evaluation--09' },
  { cohort: 'disliked', round: 1, ideaId: 'the-kids-train-to-lose--01' },
  { cohort: 'disliked', round: 1, ideaId: 'the-remote-skips-a-lifetime--02' },
  { cohort: 'disliked', round: 1, ideaId: 'teaching-to-the-test--01' },
  { cohort: 'disliked', round: 1, ideaId: 'todd-enforces-no-witnesses--03' },
  { cohort: 'disliked', round: 1, ideaId: 'dominator-wont-fire--02' },
  { cohort: 'disliked', round: 1, ideaId: 'pied-pipers-self-sabotage--03' },
  { cohort: 'disliked', round: 1, ideaId: 'cartman-as-awesom-o--04' },
  { cohort: 'disliked', round: 1, ideaId: 'keep-summer-safe--03' },
  { cohort: 'disliked', round: 1, ideaId: 'cookie-in-solitary--02' },
  { cohort: 'disliked', round: 1, ideaId: 'taumoeba-escapes-containment--01' },
  { cohort: 'disliked', round: 1, ideaId: 'auto-enforces-directive-a113--02' },
  { cohort: 'disliked', round: 1, ideaId: 'wopr-plays-for-real--01' },
  { cohort: 'disliked', round: 1, ideaId: 'alien-mothers-directive--02' },
  { cohort: 'disliked', round: 2, ideaId: 'scaling-past-one-benchmark--04' },
  { cohort: 'disliked', round: 2, ideaId: 'would-you-like-to-know-more--05' }
]

export async function buildArchiveComparisonManifest(): Promise<ArchiveComparisonManifest> {
  const rounds = await Promise.all(
    [1, 2, 3, 4, 5].map(async (round) => {
      const roundName = `round-${String(round).padStart(2, '0')}`
      const roundDirectory = join(reviewDirectory, 'rounds', roundName)
      const [ideas, feedback, assets] = await Promise.all([
        readJson<readonly ArchivedIdeaGroup[]>(
          join(roundDirectory, 'ideas.json')
        ),
        readJson<{
          readonly feedback: Readonly<Record<string, ArchivedFeedback>>
        }>(join(roundDirectory, 'feedback.json')),
        readOptionalJson<readonly ArchivedAsset[]>(
          join(roundDirectory, 'assets.json'),
          []
        )
      ])
      return { round, roundName, ideas, feedback: feedback.feedback, assets }
    })
  )
  const [previewArchive, scenarios, sources] = await Promise.all([
    readJson<{ readonly scenarios: readonly ArchivedScenarioPreview[] }>(
      join(reviewDirectory, 'rounds', 'round-01', 'scenario-previews.json')
    ),
    readJson<readonly ArchivedScenario[]>(
      join(snapshotDirectory, 'scenarios.json')
    ),
    readJson<readonly ArchivedSource[]>(join(snapshotDirectory, 'sources.json'))
  ])
  const reviewWorkspace = await loadMemeReviewWorkspace(
    join(reviewDirectory, 'rounds')
  )
  const reviewCatalog = await loadMemeReviewCatalog(reviewWorkspace)
  const finalizedTargets = resolveFinalizedMemeRenderTargets({
    sources: reviewCatalog.sources,
    historyByIdeaId: reviewCatalog.historyByIdeaId,
    feedback: reviewWorkspace.activeBatch.feedback.feedback,
    activeRevisionKey: reviewCatalog.activeRevisionKey,
    activeRevisionLabel: reviewCatalog.activeRevisionLabel
  })
  const finalizedTargetsByIdeaId = new Map(
    finalizedTargets.map((target) => [target.ideaId, target])
  )
  const scenariosBySlug = new Map(
    scenarios.map((scenario) => [scenario.slug, scenario])
  )
  const sourcesById = new Map(sources.map((source) => [source.id, source]))
  const previewsBySlug = new Map(
    previewArchive.scenarios.map((preview) => [preview.scenario_slug, preview])
  )

  const cases = selectionSeeds.map((seed): ArchiveComparisonCase => {
    const round = required(
      rounds.find((candidate) => candidate.round === seed.round),
      `round ${seed.round}`
    )
    const activeMatch = findIdea(round.ideas, seed.ideaId)
    const finalizedTarget =
      seed.cohort === 'finalized'
        ? required(
            finalizedTargetsByIdeaId.get(seed.ideaId),
            `finalized payload for ${seed.ideaId}`
          )
        : undefined
    const match = finalizedTarget
      ? {
          scenarioSlug: finalizedTarget.scenarioSlug,
          idea: toArchivedIdea(finalizedTarget)
        }
      : activeMatch
    const feedback = required(
      round.feedback[seed.ideaId],
      `feedback for ${seed.ideaId}`
    )
    const scenario = required(
      scenariosBySlug.get(match.scenarioSlug),
      `scenario ${match.scenarioSlug}`
    )
    const source = required(
      sourcesById.get(scenario.sourceId),
      `source ${scenario.sourceId}`
    )
    const expectedRating = seed.cohort === 'finalized' ? 'like' : 'dislike'
    if (feedback.rating !== expectedRating) {
      throw new Error(
        `${seed.ideaId} is ${feedback.rating ?? 'unrated'}, expected ${expectedRating}`
      )
    }
    if (seed.cohort === 'finalized' && !feedback.locked) {
      throw new Error(`${seed.ideaId} is not locked in the finalized round`)
    }

    return {
      case_id: `case-${shortHash(`${seed.round}:${seed.ideaId}`)}`,
      cohort: seed.cohort,
      source_round: seed.round,
      idea_id: seed.ideaId,
      scenario_slug: match.scenarioSlug,
      scenario_title: finalizedTarget?.scenarioTitle ?? scenario.title,
      source_title: finalizedTarget?.sourceTitle ?? source.title,
      human_rating: expectedRating,
      human_feedback: feedback.notes?.trim() || null,
      locked_copy: seed.cohort === 'finalized',
      feedback_source: `data/meme-review/rounds/${round.roundName}/feedback.json`,
      finalized_version: feedback.finalizedVersion ?? null,
      idea: match.idea,
      scenario: {
        scene: scenario.scene,
        why_analogy_works: scenario.whyAnalogyWorks,
        caveats: scenario.caveats?.trim() ? [scenario.caveats.trim()] : []
      },
      source_assets: finalizedTarget
        ? sourceAssetsFromFinalizedTarget(
            finalizedTarget,
            rounds.flatMap(({ assets }) => assets)
          )
        : resolveSourceAssets({
            seed,
            idea: match.idea,
            scenarioSlug: match.scenarioSlug,
            roundAssets: round.assets,
            allRoundAssets: rounds.flatMap(({ assets }) => assets),
            previewsBySlug
          })
    }
  })

  const uniqueScenarios = new Set(
    cases.map(({ scenario_slug }) => scenario_slug)
  )
  if (cases.length !== 50 || uniqueScenarios.size !== 50) {
    throw new Error(
      `Selection must contain 50 unique scenarios; got ${cases.length} cases and ${uniqueScenarios.size} scenarios`
    )
  }

  return {
    schema_version: 1,
    selection_policy: {
      total: 50,
      finalized: 25,
      disliked: 25,
      unique_scenarios: true,
      summary:
        'Twenty-five locked Batch 5 finalists and twenty-five earlier human dislikes. Explicit notes are preferred; remaining dislikes broaden source, concept, copy, and template coverage.'
    },
    cases
  }
}

export async function writeArchiveComparisonManifest(): Promise<void> {
  const manifest = await buildArchiveComparisonManifest()
  await writeFile(
    selectionManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
}

function resolveSourceAssets({
  seed,
  idea,
  scenarioSlug,
  roundAssets,
  allRoundAssets,
  previewsBySlug
}: {
  readonly seed: SelectionSeed
  readonly idea: ArchivedIdea
  readonly scenarioSlug: string
  readonly roundAssets: readonly ArchivedAsset[]
  readonly allRoundAssets: readonly ArchivedAsset[]
  readonly previewsBySlug: ReadonlyMap<string, ArchivedScenarioPreview>
}): readonly ArchivedAsset[] {
  if (seed.round !== 1 && idea.preview.asset_ids?.length) {
    return idea.preview.asset_ids.map((assetId) =>
      required(
        roundAssets.find(({ id }) => id === assetId),
        `asset ${assetId} in round ${seed.round}`
      )
    )
  }

  const preview = required(
    previewsBySlug.get(scenarioSlug),
    `Round 1 preview ${scenarioSlug}`
  )
  const protectedSource = allRoundAssets.find(
    ({ content_hash }) => content_hash === preview.content_hash
  )
  return [
    {
      id: `${scenarioSlug}--curated`,
      scenario_slug: scenarioSlug,
      src: preview.src,
      width: preview.width,
      height: preview.height,
      alt: preview.alt,
      content_hash: preview.content_hash,
      protected_regions: protectedSource?.protected_regions ?? []
    }
  ]
}

function findIdea(groups: readonly ArchivedIdeaGroup[], ideaId: string) {
  for (const group of groups) {
    const idea = group.ideas.find(({ id }) => id === ideaId)
    if (idea) return { scenarioSlug: group.scenario_slug, idea }
  }
  throw new Error(`Could not find archived idea ${ideaId}`)
}

function toArchivedIdea(target: FinalizedMemeRenderTarget): ArchivedIdea {
  if (target.renderer === 2) return target.idea

  return {
    ...target.idea,
    preview: {
      ...target.idea.preview,
      renderer: 1,
      template: legacyTemplate(target.idea.preview.layout)
    }
  }
}

function legacyTemplate(layout: string): string {
  if (layout === 'dialogue') return 'dialogue'
  if (layout === 'interface') return 'interface'
  return 'overlay'
}

function sourceAssetsFromFinalizedTarget(
  target: FinalizedMemeRenderTarget,
  allRoundAssets: readonly ArchivedAsset[]
): readonly ArchivedAsset[] {
  if (target.renderer === 2) {
    return target.idea.preview.asset_ids.map((assetId) =>
      required(
        target.assets.find(({ id }) => id === assetId),
        `finalized asset ${assetId} for ${target.ideaId}`
      )
    )
  }

  const protectedSource = allRoundAssets.find(
    ({ content_hash }) => content_hash === target.image.contentHash
  )
  return [
    {
      id: `${target.scenarioSlug}--curated`,
      scenario_slug: target.scenarioSlug,
      src: target.image.src,
      width: target.image.width,
      height: target.image.height,
      alt: target.image.alt,
      content_hash: target.image.contentHash,
      protected_regions: protectedSource?.protected_regions ?? []
    }
  ]
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}`)
  return value
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function readOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  await writeArchiveComparisonManifest()
  console.log(selectionManifestPath)
}
