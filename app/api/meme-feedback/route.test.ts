import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { memeIdeaIds } from '@/lib/meme-review/catalog'
import { readMemeFeedback } from '@/lib/meme-review/store'

import { PATCH } from './route'

const temporaryDirectories: string[] = []
const originalFeedbackPath = process.env.MEME_FEEDBACK_PATH

afterEach(async () => {
  if (originalFeedbackPath === undefined) {
    delete process.env.MEME_FEEDBACK_PATH
  } else {
    process.env.MEME_FEEDBACK_PATH = originalFeedbackPath
  }

  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('meme feedback route', () => {
  it('validates and persists a feedback patch for a current idea', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const ideaId = memeIdeaIds.values().next().value
    if (!ideaId) throw new Error('Expected the meme catalog to contain an idea')

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            {
              ideaId,
              feedback: { rating: 'like', notes: 'Keep this direction.' }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await readMemeFeedback(path)).feedback[ideaId]).toEqual({
      rating: 'like',
      notes: 'Keep this direction.'
    })
  })

  it('rejects unknown idea ids without creating feedback', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            {
              ideaId: 'not-a-current-idea--01',
              feedback: { rating: 'neutral', notes: '' }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(400)
    expect(await readMemeFeedback(path)).toMatchObject({ feedback: {} })
  })
})
