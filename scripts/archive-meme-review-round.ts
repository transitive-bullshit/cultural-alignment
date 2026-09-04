import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { contentCatalog } from '../lib/content/snapshot'
import { focalPointToObjectPosition } from '../lib/media/crop'
import {
  memeFeedbackDocumentV1Schema,
  memeIdeaCollectionV1Schema,
  memeIdeaCollectionV2Schema,
  memeReviewStateDocumentSchema
} from '../lib/meme-review/schema'
import {
  extractUrlContentHash,
  jsonText,
  memeReviewPath,
  memeReviewRoundsPath,
  parseNamedArgument,
  readJson,
  sha256,
  writeJsonExclusiveOrVerify,
  writeTextExclusiveOrVerify
} from './meme-review-round-utils'

const roundName = parseNamedArgument('round')

if (!roundName || !/^round-\d{2}$/.test(roundName)) {
  throw new Error(
    'Pass an explicit archive destination such as --round=round-01'
  )
}

const roundNumber = Number(roundName.slice('round-'.length))
const ideasSourcePath = resolve(
  parseNamedArgument('ideas') ?? join(memeReviewPath, 'ideas.json')
)
const feedbackSourcePath = resolve(
  parseNamedArgument('feedback') ?? join(memeReviewPath, 'feedback.json')
)
const archivePath = join(memeReviewRoundsPath, roundName)
const ideasArchivePath = join(archivePath, 'ideas.json')
const feedbackArchivePath = join(archivePath, 'feedback.json')
const previewsArchivePath = join(archivePath, 'scenario-previews.json')
const manifestArchivePath = join(archivePath, 'manifest.json')

const archiveCopies = [
  [ideasSourcePath, ideasArchivePath],
  [feedbackSourcePath, feedbackArchivePath]
] as const

for (const [source, destination] of archiveCopies) {
  if (source === resolve(destination)) {
    throw new Error(`Archive source and destination are identical: ${source}`)
  }
}

const [ideasText, feedbackText] = await Promise.all([
  readFile(ideasSourcePath, 'utf8'),
  readFile(feedbackSourcePath, 'utf8')
])
const rawIdeas = JSON.parse(ideasText)
const rawFeedback = JSON.parse(feedbackText)
const ideaCollection =
  roundNumber === 1
    ? memeIdeaCollectionV1Schema.parse(rawIdeas)
    : roundNumber === 2
      ? memeIdeaCollectionV2Schema.parse(rawIdeas)
      : unsupportedRound(roundNumber)

if (roundNumber === 1) {
  memeFeedbackDocumentV1Schema.parse(rawFeedback)
} else if (roundNumber === 2) {
  memeReviewStateDocumentSchema.parse(rawFeedback)
}

const scenarioPreviews = {
  version: 1,
  round: roundNumber,
  scenarios: ideaCollection.map(({ scenario_slug }) => {
    const scenario = contentCatalog.getScenarioPage(scenario_slug)
    if (!scenario) throw new Error(`Unknown scenario: ${scenario_slug}`)

    const contentHash = extractUrlContentHash(scenario.image.gallerySrc)
    if (!contentHash) {
      throw new Error(
        `Curated preview URL has no embedded SHA-256 for ${scenario_slug}: ${scenario.image.gallerySrc}`
      )
    }

    return {
      scenario_slug,
      src: scenario.image.gallerySrc,
      width: scenario.image.width,
      height: scenario.image.height,
      alt: scenario.image.alt,
      blur_data_url: scenario.image.blurDataURL,
      object_position: focalPointToObjectPosition(scenario.image.focalPoint),
      content_hash: contentHash
    }
  })
}
const previewsText = jsonText(scenarioPreviews)
const expectedManifest = {
  version: 1,
  round: roundName,
  files: {
    'ideas.json': {
      bytes: Buffer.byteLength(ideasText),
      sha256: sha256(ideasText)
    },
    'feedback.json': {
      bytes: Buffer.byteLength(feedbackText),
      sha256: sha256(feedbackText)
    },
    'scenario-previews.json': {
      bytes: Buffer.byteLength(previewsText),
      sha256: sha256(previewsText)
    }
  }
}

const results = await Promise.all([
  writeTextExclusiveOrVerify(ideasArchivePath, ideasText),
  writeTextExclusiveOrVerify(feedbackArchivePath, feedbackText),
  writeTextExclusiveOrVerify(previewsArchivePath, previewsText)
])

try {
  const existingManifest = await readJson(manifestArchivePath)
  if (jsonText(existingManifest) !== jsonText(expectedManifest)) {
    throw new Error(
      `Archive manifest mismatch for ${roundName}; no files were overwritten`
    )
  }
  results.push('verified')
} catch (err) {
  if (!isMissingFileError(err)) throw err
  results.push(
    await writeJsonExclusiveOrVerify(manifestArchivePath, expectedManifest)
  )
}

const createdCount = results.filter((result) => result === 'created').length
console.log(
  `${createdCount ? `Created ${createdCount}` : 'Verified all'} immutable ${roundName} archive file${createdCount === 1 ? '' : 's'} (${ideaCollection.length} scenarios).`
)

function unsupportedRound(round: number): never {
  throw new Error(
    `Round ${round} does not yet have a versioned idea schema; update this script before archiving it`
  )
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
