import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  memeFeedbackDocumentSchema,
  type MemeFeedbackDocument,
  type MemeFeedbackPatch
} from './schema'

const defaultFeedbackPath = join(
  process.cwd(),
  'data',
  'meme-review',
  'feedback.json'
)

let writeQueue = Promise.resolve()

export function getMemeFeedbackPath() {
  return process.env.MEME_FEEDBACK_PATH ?? defaultFeedbackPath
}

export async function readMemeFeedback(
  path = getMemeFeedbackPath()
): Promise<MemeFeedbackDocument> {
  try {
    const source = await readFile(path, 'utf8')
    return memeFeedbackDocumentSchema.parse(JSON.parse(source))
  } catch (err) {
    if (isMissingFileError(err)) return emptyMemeFeedback()
    throw err
  }
}

export async function patchMemeFeedback(
  updates: readonly MemeFeedbackPatch[],
  path = getMemeFeedbackPath()
): Promise<MemeFeedbackDocument> {
  const operation = writeQueue.then(async () => {
    const current = await readMemeFeedback(path)
    const nextFeedback = { ...current.feedback }

    for (const { ideaId, feedback } of updates) {
      if (feedback.rating === null && feedback.notes.trim() === '') {
        delete nextFeedback[ideaId]
      } else {
        nextFeedback[ideaId] = feedback
      }
    }

    const next = memeFeedbackDocumentSchema.parse({
      version: 1,
      updatedAt: new Date().toISOString(),
      feedback: nextFeedback
    })
    const directory = dirname(path)
    const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`

    await mkdir(directory, { recursive: true })
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)

    return next
  })

  writeQueue = operation.then(
    () => undefined,
    () => undefined
  )

  return operation
}

function emptyMemeFeedback(): MemeFeedbackDocument {
  return {
    version: 1,
    updatedAt: null,
    feedback: {}
  }
}

function isMissingFileError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
