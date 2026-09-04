import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { withMemeReviewFileLock } from './file-lock'
import {
  memeFeedbackEntrySchema,
  memeFeedbackBatchPatchSchema,
  memeFeedbackDocumentV1Schema,
  memeReviewBatchPatchSchema,
  memeReviewStateDocumentSchema,
  type MemeFeedbackDocumentV1,
  type MemeFeedbackEntry,
  type MemeFeedbackPatch,
  type MemeReviewBatchPatch,
  type MemeReviewStateDocument
} from './schema'

const legacyFeedbackPath = join(
  process.cwd(),
  'data',
  'meme-review',
  'feedback.json'
)
let writeQueue = Promise.resolve()

export type PatchMemeReviewStateOptions = {
  readonly beforeCommit?: () => Promise<void> | void
}

export class FinalizedMemeMutationError extends Error {
  readonly ideaId: string

  constructor(ideaId: string) {
    super(`Meme idea ${ideaId} is finalized; unfinalize it before editing`)
    this.name = 'FinalizedMemeMutationError'
    this.ideaId = ideaId
  }
}

export class StaleMemeFinalizationError extends Error {
  readonly ideaId: string

  constructor(ideaId: string) {
    super(
      `Meme idea ${ideaId} changed finalization state in another review session; reload before trying again`
    )
    this.name = 'StaleMemeFinalizationError'
    this.ideaId = ideaId
  }
}

export function getMemeFeedbackPath() {
  return process.env.MEME_FEEDBACK_PATH ?? legacyFeedbackPath
}

export function getMemeReviewStatePath(defaultPath: string) {
  return (
    process.env.MEME_REVIEW_STATE_PATH ??
    process.env.MEME_FEEDBACK_PATH ??
    defaultPath
  )
}

export async function readMemeReviewState(
  path: string,
  batch: number
): Promise<MemeReviewStateDocument> {
  try {
    const source = await readFile(path, 'utf8')
    const document = memeReviewStateDocumentSchema.parse(JSON.parse(source))
    if (document.round !== batch) {
      throw new Error(
        `Meme review state belongs to batch ${document.round}, expected ${batch}`
      )
    }
    return document
  } catch (err) {
    if (isMissingFileError(err)) return emptyMemeReviewState(batch)
    throw err
  }
}

export async function patchMemeReviewState(
  patch: MemeReviewBatchPatch,
  path: string,
  options: PatchMemeReviewStateOptions = {}
): Promise<MemeReviewStateDocument> {
  const operation = writeQueue.then(() =>
    withMemeReviewFileLock(path, async () => {
      const parsedPatch = memeReviewBatchPatchSchema.parse(patch)
      const current = await readMemeReviewState(path, parsedPatch.round)
      const feedback = { ...current.feedback }
      const scenarios = { ...current.scenarios }

      for (const patchEntry of parsedPatch.ideaUpdates) {
        const { ideaId } = patchEntry
        const entry = mergeFeedbackEntry(current.feedback[ideaId], patchEntry)

        if (isEmptyFeedback(entry)) {
          delete feedback[ideaId]
        } else {
          feedback[ideaId] = entry
        }
      }

      for (const { scenarioSlug, disabled } of parsedPatch.scenarioUpdates) {
        if (disabled) {
          scenarios[scenarioSlug] = { disabled: true }
        } else {
          delete scenarios[scenarioSlug]
        }
      }

      const next = memeReviewStateDocumentSchema.parse({
        version: 2,
        round: parsedPatch.round,
        updatedAt: new Date().toISOString(),
        feedback,
        scenarios
      })

      await options.beforeCommit?.()
      await writeDocument(path, next)
      return next
    })
  )

  writeQueue = operation.then(
    () => undefined,
    () => undefined
  )

  return operation
}

export async function readMemeFeedback(
  path = getMemeFeedbackPath()
): Promise<MemeFeedbackDocumentV1> {
  try {
    const source = await readFile(path, 'utf8')
    return memeFeedbackDocumentV1Schema.parse(JSON.parse(source))
  } catch (err) {
    if (isMissingFileError(err)) return emptyMemeFeedback()
    throw err
  }
}

export async function patchMemeFeedback(
  updates: readonly MemeFeedbackPatch[],
  path = getMemeFeedbackPath()
): Promise<MemeFeedbackDocumentV1> {
  const operation = writeQueue.then(() =>
    withMemeReviewFileLock(path, async () => {
      const parsedUpdates = memeFeedbackBatchPatchSchema.parse({
        updates
      }).updates
      const current = await readMemeFeedback(path)
      const nextFeedback = { ...current.feedback }

      for (const patchEntry of parsedUpdates) {
        const { ideaId } = patchEntry
        const entry = mergeFeedbackEntry(current.feedback[ideaId], patchEntry)

        if (isEmptyFeedback(entry)) {
          delete nextFeedback[ideaId]
        } else {
          nextFeedback[ideaId] = entry
        }
      }

      const next = memeFeedbackDocumentV1Schema.parse({
        version: 1,
        updatedAt: new Date().toISOString(),
        feedback: nextFeedback
      })
      await writeDocument(path, next)

      return next
    })
  )

  writeQueue = operation.then(
    () => undefined,
    () => undefined
  )

  return operation
}

function emptyMemeFeedback(): MemeFeedbackDocumentV1 {
  return {
    version: 1,
    updatedAt: null,
    feedback: {}
  }
}

export function emptyMemeReviewState(batch: number): MemeReviewStateDocument {
  return {
    version: 2,
    round: batch,
    updatedAt: null,
    feedback: {},
    scenarios: {}
  }
}

async function writeDocument(path: string, document: unknown) {
  const directory = dirname(path)
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`

  await mkdir(directory, { recursive: true })
  await writeFile(
    temporaryPath,
    `${JSON.stringify(document, null, 2)}\n`,
    'utf8'
  )
  await rename(temporaryPath, path)
}

function isMissingFileError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function mergeFeedbackEntry(
  current: MemeFeedbackEntry | undefined,
  patch: MemeFeedbackPatch
): MemeFeedbackEntry {
  const { ideaId, feedback } = patch
  const currentEntry = current ?? {
    rating: null,
    notes: '',
    locked: false,
    lockRevision: 0
  }
  const currentLocked = currentEntry.locked
  const locked = feedback.locked ?? currentLocked
  const targetRevisionKey = patch.targetRevisionKey
  const expectedPayloadFingerprint = patch.expectedPayloadFingerprint

  if (
    feedback.locked !== undefined &&
    (targetRevisionKey === undefined ||
      expectedPayloadFingerprint === undefined)
  ) {
    throw new Error('Parsed finalization patch is missing its revision target')
  }

  const finalizedVersion =
    feedback.locked === true
      ? {
          revisionKey: targetRevisionKey!,
          payloadFingerprint: expectedPayloadFingerprint!
        }
      : feedback.locked === false
        ? undefined
        : currentEntry.finalizedVersion

  if (
    patch.expectedFeedback !== undefined &&
    !isDeepStrictEqual(patch.expectedFeedback, currentEntry)
  ) {
    throw new StaleMemeFinalizationError(ideaId)
  }

  if (
    current?.locked === true &&
    locked &&
    (feedback.rating !== current.rating ||
      feedback.notes !== current.notes ||
      (current.finalizedVersion !== undefined &&
        !isDeepStrictEqual(current.finalizedVersion, finalizedVersion)))
  ) {
    throw new FinalizedMemeMutationError(ideaId)
  }

  const nextEntry = {
    ...feedback,
    locked,
    lockRevision:
      currentEntry.lockRevision +
      (feedback.locked !== undefined && locked !== currentLocked ? 1 : 0)
  }

  return memeFeedbackEntrySchema.parse(
    finalizedVersion === undefined
      ? nextEntry
      : { ...nextEntry, finalizedVersion }
  )
}

function isEmptyFeedback(entry: MemeFeedbackEntry) {
  return (
    !entry.locked &&
    entry.lockRevision === 0 &&
    entry.rating === null &&
    entry.notes.trim() === ''
  )
}
