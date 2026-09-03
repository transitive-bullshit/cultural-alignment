import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { patchMemeFeedback, readMemeFeedback } from './store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('meme feedback store', () => {
  it('starts empty and atomically merges feedback patches', async () => {
    const path = await createFeedbackPath()

    expect(await readMemeFeedback(path)).toEqual({
      version: 1,
      updatedAt: null,
      feedback: {}
    })

    await patchMemeFeedback(
      [
        {
          ideaId: 'first--01',
          feedback: { rating: 'like', notes: 'Keep the hinge.' }
        },
        {
          ideaId: 'second--01',
          feedback: { rating: null, notes: 'Try another frame.' }
        }
      ],
      path
    )
    await patchMemeFeedback(
      [
        {
          ideaId: 'first--01',
          feedback: { rating: 'neutral', notes: '' }
        }
      ],
      path
    )

    const document = await readMemeFeedback(path)
    expect(document.feedback).toEqual({
      'first--01': { rating: 'neutral', notes: '' },
      'second--01': { rating: null, notes: 'Try another frame.' }
    })
    expect(document.updatedAt).toEqual(expect.any(String))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(document)
  })

  it('removes a cleared entry without disturbing other feedback', async () => {
    const path = await createFeedbackPath()

    await patchMemeFeedback(
      [
        {
          ideaId: 'first--01',
          feedback: { rating: 'like', notes: '' }
        },
        {
          ideaId: 'second--01',
          feedback: { rating: 'dislike', notes: '' }
        }
      ],
      path
    )
    const document = await patchMemeFeedback(
      [
        {
          ideaId: 'first--01',
          feedback: { rating: null, notes: '   ' }
        }
      ],
      path
    )

    expect(document.feedback).toEqual({
      'second--01': { rating: 'dislike', notes: '' }
    })
  })

  it('surfaces malformed persisted JSON', async () => {
    const path = await createFeedbackPath()
    await writeFile(path, '{not-json', 'utf8')

    await expect(readMemeFeedback(path)).rejects.toBeInstanceOf(SyntaxError)
  })
})

async function createFeedbackPath() {
  const directory = await mkdtemp(join(tmpdir(), 'meme-feedback-test-'))
  temporaryDirectories.push(directory)
  return join(directory, 'feedback.json')
}
