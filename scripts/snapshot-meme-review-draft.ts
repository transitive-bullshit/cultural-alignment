import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewStateDocumentSchema
} from '../lib/meme-review/schema'
import {
  jsonText,
  memeReviewRoundsPath,
  parseNamedArgument,
  sha256,
  writeJsonExclusiveOrVerify,
  writeTextExclusiveOrVerify
} from './meme-review-round-utils'

const draftName = parseNamedArgument('name')
if (!draftName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draftName)) {
  throw new Error(
    'Choose an immutable draft name, for example --name=seed-review-checkpoint-01'
  )
}

const roundName = parseNamedArgument('round') ?? 'round-02'
if (!/^round-\d{2,}$/.test(roundName)) {
  throw new Error('Choose a batch such as --round=round-02')
}

const roundNumber = Number(roundName.slice('round-'.length))
const batchPath = join(memeReviewRoundsPath, roundName)
const draftPath = join(batchPath, 'drafts', draftName)
const sourcePaths = {
  'ideas.json': join(batchPath, 'ideas.json'),
  'assets.json': join(batchPath, 'assets.json'),
  'feedback.json': join(batchPath, 'feedback.json')
} as const
const sourceEntries = await Promise.all(
  Object.entries(sourcePaths).map(async ([name, path]) => [
    name,
    await readFile(path, 'utf8')
  ])
)
const sourceTexts = Object.fromEntries(sourceEntries) as Record<
  keyof typeof sourcePaths,
  string
>

memeIdeaCollectionV2Schema.parse(JSON.parse(sourceTexts['ideas.json']))
memeReviewAssetCollectionSchema.parse(JSON.parse(sourceTexts['assets.json']))
const feedback = memeReviewStateDocumentSchema.parse(
  JSON.parse(sourceTexts['feedback.json'])
)
if (feedback.round !== roundNumber) {
  throw new Error(
    `${roundName}/feedback.json identifies batch ${feedback.round}, expected ${roundNumber}`
  )
}

const manifest = {
  version: 1,
  round: roundNumber,
  draft: draftName,
  feedback_updated_at: feedback.updatedAt,
  warning:
    'This feedback reviews the exact draft ideas in this directory. Do not transfer ratings by ID to later copy without comparing the archived idea payload.',
  files: Object.fromEntries(
    Object.entries(sourceTexts).map(([name, contents]) => [
      name,
      {
        bytes: Buffer.byteLength(contents),
        sha256: sha256(contents)
      }
    ])
  )
}

const results = await Promise.all([
  ...Object.entries(sourceTexts).map(([name, contents]) =>
    writeTextExclusiveOrVerify(join(draftPath, name), contents)
  ),
  writeJsonExclusiveOrVerify(join(draftPath, 'manifest.json'), manifest)
])

console.log(
  `${results.some((result) => result === 'created') ? 'Created' : 'Verified'} immutable draft snapshot ${draftName}: ${Object.keys(feedback.feedback).length} idea reviews and ${Object.keys(feedback.scenarios).length} disabled scenarios.\n${jsonText(manifest.files)}`
)
