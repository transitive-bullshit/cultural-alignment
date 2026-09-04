import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FinalizedMemeMutationError,
  patchMemeFeedback,
  patchMemeReviewState,
  readMemeFeedback,
  readMemeReviewState
} from './store'

const temporaryDirectories: string[] = []
const payloadFingerprint = 'v1-0000000000000000-1'
const targetRevisionKey = 'round-01'

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('meme feedback store', () => {
  it('starts a requested batch empty and sparsely merges review patches', async () => {
    const path = await createFeedbackPath()
    const batch = 7

    expect(await readMemeReviewState(path, batch)).toEqual({
      version: 2,
      round: batch,
      updatedAt: null,
      feedback: {},
      scenarios: {}
    })

    await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { rating: 'like', notes: 'Keep the hinge.' }
          }
        ],
        scenarioUpdates: [
          { scenarioSlug: 'first', disabled: true },
          { scenarioSlug: 'second', disabled: true }
        ]
      },
      path
    )

    const document = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { rating: null, notes: '  ' }
          }
        ],
        scenarioUpdates: [{ scenarioSlug: 'first', disabled: false }]
      },
      path
    )

    expect(document.feedback).toEqual({})
    expect(document.scenarios).toEqual({ second: { disabled: true } })
    expect(document.updatedAt).toEqual(expect.any(String))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(document)
  })

  it('runs the pre-commit check before writing and aborts the whole patch', async () => {
    const path = await createFeedbackPath()
    const batch = 7
    const failure = new Error('Payload changed before commit')

    await expect(
      patchMemeReviewState(
        {
          round: batch,
          ideaUpdates: [
            {
              ideaId: 'first--01',
              feedback: { rating: 'like', notes: 'Do not persist this.' }
            }
          ],
          scenarioUpdates: []
        },
        path,
        {
          beforeCommit: () => {
            throw failure
          }
        }
      )
    ).rejects.toBe(failure)

    expect(await readMemeReviewState(path, batch)).toEqual({
      version: 2,
      round: batch,
      updatedAt: null,
      feedback: {},
      scenarios: {}
    })
  })

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
      'first--01': {
        rating: 'neutral',
        notes: '',
        locked: false,
        lockRevision: 0
      },
      'second--01': {
        rating: null,
        notes: 'Try another frame.',
        locked: false,
        lockRevision: 0
      }
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
      'second--01': {
        rating: 'dislike',
        notes: '',
        locked: false,
        lockRevision: 0
      }
    })
  })

  it('freezes finalized feedback until an explicit unlock', async () => {
    const path = await createFeedbackPath()
    const batch = 7

    const finalized = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: {
              rating: 'like',
              notes: 'Final copy and composition.',
              locked: true
            },
            expectedFeedback: {
              rating: null,
              notes: '',
              locked: false,
              lockRevision: 0
            },
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    expect(finalized.feedback['first--01']).toMatchObject({
      locked: true,
      lockRevision: 1,
      finalizedVersion: {
        revisionKey: targetRevisionKey,
        payloadFingerprint
      }
    })

    await expect(
      patchMemeReviewState(
        {
          round: batch,
          ideaUpdates: [
            {
              ideaId: 'first--01',
              feedback: {
                rating: 'like',
                notes: 'Silently changed while still finalized.'
              }
            }
          ],
          scenarioUpdates: []
        },
        path
      )
    ).rejects.toBeInstanceOf(FinalizedMemeMutationError)

    const unlocked = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: {
              rating: 'like',
              notes: 'Editing resumed after an explicit unlock.',
              locked: false
            },
            expectedFeedback: {
              rating: 'like',
              notes: 'Final copy and composition.',
              locked: true,
              lockRevision: 1,
              finalizedVersion: {
                revisionKey: targetRevisionKey,
                payloadFingerprint
              }
            },
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    expect(unlocked.feedback['first--01']).toEqual({
      rating: 'like',
      notes: 'Editing resumed after an explicit unlock.',
      locked: false,
      lockRevision: 2
    })
  })

  it('rejects a stale tab trying to clear a newer finalization', async () => {
    const path = await createFeedbackPath()
    const batch = 7

    await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { rating: 'like', notes: '', locked: true },
            expectedFeedback: {
              rating: null,
              notes: '',
              locked: false,
              lockRevision: 0
            },
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    await expect(
      patchMemeReviewState(
        {
          round: batch,
          ideaUpdates: [
            {
              ideaId: 'first--01',
              feedback: {
                rating: 'like',
                notes: 'A stale browser tab tried to save this.',
                locked: false
              },
              expectedFeedback: {
                rating: null,
                notes: '',
                locked: false,
                lockRevision: 0
              },
              targetRevisionKey,
              expectedPayloadFingerprint: payloadFingerprint
            }
          ],
          scenarioUpdates: []
        },
        path
      )
    ).rejects.toMatchObject({ name: 'StaleMemeFinalizationError' })

    expect(
      (await readMemeReviewState(path, batch)).feedback['first--01']
    ).toEqual({
      rating: 'like',
      notes: '',
      locked: true,
      lockRevision: 1,
      finalizedVersion: {
        revisionKey: targetRevisionKey,
        payloadFingerprint
      }
    })
  })

  it('materializes one legacy locked revision without advancing its CAS', async () => {
    const path = await createFeedbackPath()
    const batch = 7
    const legacyFeedback = {
      rating: 'like' as const,
      notes: 'Approved before revision pointers existed.',
      locked: true,
      lockRevision: 1
    }
    await writeFile(
      path,
      `${JSON.stringify({
        version: 2,
        round: batch,
        updatedAt: null,
        feedback: { 'first--01': legacyFeedback },
        scenarios: {}
      })}\n`,
      'utf8'
    )

    const document = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { ...legacyFeedback, locked: true },
            expectedFeedback: legacyFeedback,
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    expect(document.feedback['first--01']).toEqual({
      ...legacyFeedback,
      finalizedVersion: {
        revisionKey: targetRevisionKey,
        payloadFingerprint
      }
    })
  })

  it('does not retarget a finalized version without an explicit unlock', async () => {
    const path = await createFeedbackPath()
    const batch = 7
    const finalized = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { rating: 'like', notes: '', locked: true },
            expectedFeedback: {
              rating: null,
              notes: '',
              locked: false,
              lockRevision: 0
            },
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    await expect(
      patchMemeReviewState(
        {
          round: batch,
          ideaUpdates: [
            {
              ideaId: 'first--01',
              feedback: { rating: 'like', notes: '', locked: true },
              expectedFeedback: finalized.feedback['first--01']!,
              targetRevisionKey: 'round-02',
              expectedPayloadFingerprint: payloadFingerprint
            }
          ],
          scenarioUpdates: []
        },
        path
      )
    ).rejects.toBeInstanceOf(FinalizedMemeMutationError)
  })

  it('rejects an ABA-stale finalization after an unlock cycle', async () => {
    const path = await createFeedbackPath()
    const batch = 7
    const staleSnapshot = {
      rating: 'like' as const,
      notes: 'Original review.',
      locked: false,
      lockRevision: 0
    }

    await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: {
              rating: staleSnapshot.rating,
              notes: staleSnapshot.notes
            }
          }
        ],
        scenarioUpdates: []
      },
      path
    )
    const finalized = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { ...staleSnapshot, locked: true },
            expectedFeedback: staleSnapshot,
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )
    const finalizedSnapshot = finalized.feedback['first--01']!

    await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: {
              rating: 'like',
              notes: 'New review after unfinalizing.',
              locked: false
            },
            expectedFeedback: finalizedSnapshot,
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    const cleared = await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: { rating: null, notes: '' }
          }
        ],
        scenarioUpdates: []
      },
      path
    )
    expect(cleared.feedback['first--01']).toEqual({
      rating: null,
      notes: '',
      locked: false,
      lockRevision: 2
    })

    await patchMemeReviewState(
      {
        round: batch,
        ideaUpdates: [
          {
            ideaId: 'first--01',
            feedback: {
              rating: staleSnapshot.rating,
              notes: staleSnapshot.notes
            }
          }
        ],
        scenarioUpdates: []
      },
      path
    )

    await expect(
      patchMemeReviewState(
        {
          round: batch,
          ideaUpdates: [
            {
              ideaId: 'first--01',
              feedback: { ...staleSnapshot, locked: true },
              expectedFeedback: staleSnapshot,
              targetRevisionKey,
              expectedPayloadFingerprint: payloadFingerprint
            }
          ],
          scenarioUpdates: []
        },
        path
      )
    ).rejects.toMatchObject({ name: 'StaleMemeFinalizationError' })

    expect(
      (await readMemeReviewState(path, batch)).feedback['first--01']
    ).toMatchObject({
      notes: 'Original review.',
      locked: false,
      lockRevision: 2
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
