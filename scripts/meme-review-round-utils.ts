import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { assertFinalizedMemesPreserved } from '../lib/meme-review/finalization'
import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewStateDocumentSchema,
  type MemeIdeaV2,
  type MemeReviewAsset,
  type ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'

export const workspacePath = process.cwd()
export const memeReviewPath = join(workspacePath, 'data', 'meme-review')
export const memeReviewRoundsPath = join(memeReviewPath, 'rounds')

export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function memeReviewIdeaHash(idea: MemeIdeaV2): string {
  return sha256(JSON.stringify(idea))
}

export function memeReviewIdeaEditorialPayload(idea: MemeIdeaV2) {
  return {
    id: idea.id,
    ai_concept: idea.ai_concept,
    display_context: idea.display_context,
    source_anchor: idea.source_anchor,
    caption_lines: idea.caption_lines,
    format: idea.format,
    why_it_works: idea.why_it_works
  }
}

export function memeReviewIdeaEditorialHash(idea: MemeIdeaV2): string {
  return sha256(JSON.stringify(memeReviewIdeaEditorialPayload(idea)))
}

const trailingMemePeriodPattern =
  /(?<!\.)\.(?=["'\u2018\u2019\u201c\u201d\u00ab\u00bb\u2039\u203a)\]}]*\s*$)/u
const meaningfulTerminalAbbreviationPattern =
  /(?:\b(?:[a-z]\.){2,}|\b(?:co|corp|dr|e\.g|etc|i\.e|inc|jr|ltd|mr|mrs|ms|sr|st|vs)\.)(?=["'\u2018\u2019\u201c\u201d\u00ab\u00bb\u2039\u203a)\]}]*\s*$)/iu

export function stripTerminalMemePeriod(line: string): string {
  if (meaningfulTerminalAbbreviationPattern.test(line)) return line
  return line.replace(trailingMemePeriodPattern, '')
}

export function stripTerminalMemePeriods(lines: readonly string[]): string[] {
  return lines.map(stripTerminalMemePeriod)
}

export function extractUrlContentHash(url: string): string | null {
  const matches = [
    ...url.matchAll(/(?:^|[-/])([a-f0-9]{64})(?=\.[a-z0-9]+(?:$|[?#]))/gi)
  ]
  return matches.at(-1)?.[1]?.toLowerCase() ?? null
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function assertCurrentFinalizedMemesPreserved({
  currentIdeasPath,
  currentAssetsPath,
  currentFeedbackPath,
  expectedRound,
  targetIdeas,
  targetAssets
}: {
  readonly currentIdeasPath: string
  readonly currentAssetsPath: string
  readonly currentFeedbackPath: string
  readonly expectedRound: number
  readonly targetIdeas: readonly ScenarioMemeIdeasV2[]
  readonly targetAssets: readonly MemeReviewAsset[]
}) {
  const [rawIdeas, rawAssets, rawFeedback] = await Promise.all([
    readJson(currentIdeasPath),
    readJson(currentAssetsPath),
    readJson(currentFeedbackPath)
  ])
  const currentIdeas = memeIdeaCollectionV2Schema.parse(rawIdeas)
  const currentAssets = memeReviewAssetCollectionSchema.parse(rawAssets)
  const currentFeedback = memeReviewStateDocumentSchema.parse(rawFeedback)

  if (currentFeedback.round !== expectedRound) {
    throw new Error(
      `Current feedback identifies batch ${currentFeedback.round}, expected ${expectedRound}`
    )
  }

  assertFinalizedMemesPreserved(
    {
      ideas: currentIdeas,
      assets: currentAssets,
      feedback: currentFeedback.feedback
    },
    {
      ideas: targetIdeas,
      assets: targetAssets,
      feedback: currentFeedback.feedback
    }
  )
}

export async function writeJsonExclusiveOrVerify(
  path: string,
  value: unknown
): Promise<'created' | 'verified'> {
  return writeTextExclusiveOrVerify(path, jsonText(value))
}

export async function writeTextExclusiveOrVerify(
  path: string,
  text: string
): Promise<'created' | 'verified'> {
  await mkdir(dirname(path), { recursive: true })

  try {
    await writeFile(path, text, { encoding: 'utf8', flag: 'wx' })
    return 'created'
  } catch (err) {
    if (!isAlreadyExistsError(err)) throw err

    const existing = await readFile(path, 'utf8')
    if (sha256(existing) !== sha256(text)) {
      throw new Error(
        `Refusing to overwrite ${path}: existing content does not match the requested snapshot`
      )
    }

    return 'verified'
  }
}

export async function writeJsonAtomic(
  path: string,
  value: unknown
): Promise<void> {
  await writeTextAtomic(path, jsonText(value))
}

export async function writeTextAtomic(
  path: string,
  text: string
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = join(
    dirname(path),
    `.${path.split('/').at(-1)}.${process.pid}.${randomUUID()}.tmp`
  )

  try {
    await writeFile(temporaryPath, text, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, path)
  } catch (err) {
    await unlink(temporaryPath).catch(() => undefined)
    throw err
  }
}

export async function fileDigest(path: string): Promise<{
  readonly bytes: number
  readonly sha256: string
}> {
  const [contents, metadata] = await Promise.all([readFile(path), stat(path)])
  return {
    bytes: metadata.size,
    sha256: sha256(contents)
  }
}

export function partition<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(
      `Partition size must be a positive integer, received ${size}`
    )
  }

  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )
}

export function parseNamedArgument(name: string): string | null {
  const prefix = `--${name}=`
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix))
  return argument?.slice(prefix.length) ?? null
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  )
}
