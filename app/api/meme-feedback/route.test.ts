import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const catalogLoadOverrides = vi.hoisted(() => ({
  values: [] as unknown[]
}))

vi.mock('@/lib/meme-review/catalog', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/meme-review/catalog')>()

  return {
    ...actual,
    loadMemeReviewCatalog: async (
      ...args: Parameters<typeof actual.loadMemeReviewCatalog>
    ) =>
      catalogLoadOverrides.values.shift() ??
      actual.loadMemeReviewCatalog(...args)
  }
})

import {
  loadMemeReviewCatalog,
  type MemeReviewCatalog
} from '@/lib/meme-review/catalog'
import {
  memeFinalizationFingerprint,
  memeRevisionFingerprint
} from '@/lib/meme-review/fingerprint'
import type { MemeFeedbackEntry } from '@/lib/meme-review/schema'
import { readMemeReviewState } from '@/lib/meme-review/store'

import { PATCH } from './route'

const temporaryDirectories: string[] = []
const originalFeedbackPath = process.env.MEME_FEEDBACK_PATH

afterEach(async () => {
  catalogLoadOverrides.values.length = 0

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

    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    if (!ideaId) throw new Error('Expected the meme catalog to contain an idea')

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: catalog.activeBatch,
          ideaUpdates: [
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
    await expect(response.json()).resolves.toMatchObject({
      feedback: {
        [ideaId]: {
          rating: 'like',
          notes: 'Keep this direction.',
          locked: false,
          lockRevision: 0
        }
      }
    })
    expect(
      (await readMemeReviewState(path, catalog.activeBatch)).feedback[ideaId]
    ).toEqual({
      rating: 'like',
      notes: 'Keep this direction.',
      locked: false,
      lockRevision: 0
    })
  })

  it('rejects finalized feedback edits until the same idea is explicitly unlocked', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    if (!ideaId) throw new Error('Expected the meme catalog to contain an idea')
    const payloadFingerprint = fingerprintFor(catalog, ideaId)

    const finalizeResponse = await patchIdea(
      catalog.activeBatch,
      ideaId,
      {
        rating: 'like',
        notes: 'This exact version is final.',
        locked: true
      },
      {
        rating: null,
        notes: '',
        locked: false,
        lockRevision: 0
      },
      catalog.activeRevisionKey,
      payloadFingerprint
    )
    expect(finalizeResponse.status).toBe(200)
    await expect(finalizeResponse.json()).resolves.toMatchObject({
      feedback: {
        [ideaId]: {
          rating: 'like',
          notes: 'This exact version is final.',
          locked: true,
          lockRevision: 1,
          finalizedVersion: {
            revisionKey: catalog.activeRevisionKey,
            payloadFingerprint
          }
        }
      }
    })

    const rejectedResponse = await patchIdea(catalog.activeBatch, ideaId, {
      rating: 'like',
      notes: 'Changed without unlocking.'
    })
    expect(rejectedResponse.status).toBe(409)

    const staleUnlockResponse = await patchIdea(
      catalog.activeBatch,
      ideaId,
      {
        rating: 'like',
        notes: 'A stale tab should not clear final approval.',
        locked: false
      },
      {
        rating: null,
        notes: '',
        locked: false,
        lockRevision: 0
      },
      catalog.activeRevisionKey,
      payloadFingerprint
    )
    expect(staleUnlockResponse.status).toBe(409)

    const ambiguousUnlockResponse = await patchIdea(
      catalog.activeBatch,
      ideaId,
      {
        rating: 'like',
        notes: 'An old client omitted the lock precondition.',
        locked: false
      },
      undefined,
      catalog.activeRevisionKey,
      payloadFingerprint
    )
    expect(ambiguousUnlockResponse.status).toBe(400)

    const wrongRevisionUnlockResponse = await patchIdea(
      catalog.activeBatch,
      ideaId,
      {
        rating: 'like',
        notes: 'Tried to unfinalize a different revision.',
        locked: false
      },
      {
        rating: 'like',
        notes: 'This exact version is final.',
        locked: true,
        lockRevision: 1,
        finalizedVersion: {
          revisionKey: catalog.activeRevisionKey,
          payloadFingerprint
        }
      },
      'missing-revision',
      payloadFingerprint
    )
    expect(wrongRevisionUnlockResponse.status).toBe(409)

    const unlockResponse = await patchIdea(
      catalog.activeBatch,
      ideaId,
      {
        rating: 'like',
        notes: 'Changed after explicitly unlocking.',
        locked: false
      },
      {
        rating: 'like',
        notes: 'This exact version is final.',
        locked: true,
        lockRevision: 1,
        finalizedVersion: {
          revisionKey: catalog.activeRevisionKey,
          payloadFingerprint
        }
      },
      catalog.activeRevisionKey,
      payloadFingerprint
    )
    expect(unlockResponse.status).toBe(200)
    await expect(unlockResponse.json()).resolves.toMatchObject({
      feedback: {
        [ideaId]: {
          rating: 'like',
          notes: 'Changed after explicitly unlocking.',
          locked: false,
          lockRevision: 2
        }
      }
    })
    expect(
      (await readMemeReviewState(path, catalog.activeBatch)).feedback[ideaId]
    ).toEqual({
      rating: 'like',
      notes: 'Changed after explicitly unlocking.',
      locked: false,
      lockRevision: 2
    })
  })

  it('rejects a finalization for a payload that is no longer displayed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    if (!ideaId) throw new Error('Expected the meme catalog to contain an idea')

    const response = await patchIdea(
      catalog.activeBatch,
      ideaId,
      { rating: 'like', notes: '', locked: true },
      {
        rating: null,
        notes: '',
        locked: false,
        lockRevision: 0
      },
      catalog.activeRevisionKey,
      'v1-0000000000000000-1'
    )

    expect(response.status).toBe(409)
    expect(await readMemeReviewState(path, catalog.activeBatch)).toMatchObject({
      feedback: {}
    })
  })

  it('finalizes an exact archived renderer-v1 revision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const match = Object.entries(catalog.historyByIdeaId)
      .flatMap(([ideaId, entries]) =>
        entries.map((entry) => ({ ideaId, entry }))
      )
      .find(({ entry }) => entry.renderer === 1)
    if (!match || match.entry.renderer !== 1) {
      throw new Error('Expected at least one renderer-v1 archived revision')
    }
    const payloadFingerprint = memeRevisionFingerprint({
      renderer: 1,
      idea: match.entry.idea,
      image: match.entry.image
    })

    const response = await patchIdea(
      catalog.activeBatch,
      match.ideaId,
      { rating: 'like', notes: 'Use the archived version.', locked: true },
      {
        rating: null,
        notes: '',
        locked: false,
        lockRevision: 0
      },
      match.entry.revisionKey,
      payloadFingerprint
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      feedback: {
        [match.ideaId]: {
          rating: 'like',
          notes: 'Use the archived version.',
          locked: true,
          lockRevision: 1,
          finalizedVersion: {
            revisionKey: match.entry.revisionKey,
            payloadFingerprint
          }
        }
      }
    })
  })

  it('rejects unknown idea ids without creating feedback', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path
    const catalog = await loadMemeReviewCatalog()

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: catalog.activeBatch,
          ideaUpdates: [
            {
              ideaId: 'not-a-current-idea--01',
              feedback: { rating: 'neutral', notes: '' }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(400)
    expect(await readMemeReviewState(path, catalog.activeBatch)).toMatchObject({
      feedback: {}
    })
  })

  it('rejects a stale round token without changing active feedback', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    if (!ideaId) throw new Error('Expected the meme catalog to contain an idea')

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: Math.max(1, catalog.activeBatch - 1),
          ideaUpdates: [
            {
              ideaId,
              feedback: { rating: 'like', notes: '' }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(400)
    expect(await readMemeReviewState(path, catalog.activeBatch)).toMatchObject({
      feedback: {}
    })
  })

  it('aborts ordinary feedback and scenario writes when the active batch changes before commit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    const scenarioSlug = catalog.scenarioSlugs.values().next().value
    if (!ideaId || !scenarioSlug) {
      throw new Error('Expected the meme catalog to contain review targets')
    }

    catalogLoadOverrides.values.push(catalog, {
      ...catalog,
      activeBatch: catalog.activeBatch + 1,
      activeRevisionKey: `round-${String(catalog.activeBatch + 1).padStart(2, '0')}`
    })

    const response = await PATCH(
      new Request('http://localhost/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: catalog.activeBatch,
          ideaUpdates: [
            {
              ideaId,
              feedback: { rating: 'like', notes: 'Stale ordinary autosave.' }
            }
          ],
          scenarioUpdates: [{ scenarioSlug, disabled: true }]
        })
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('batch changed')
    })
    expect(await readMemeReviewState(path, catalog.activeBatch)).toMatchObject({
      feedback: {},
      scenarios: {}
    })
  })

  it('persists and clears sparse scenario exclusions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-route-test-'))
    const path = join(directory, 'feedback.json')
    temporaryDirectories.push(directory)
    process.env.MEME_FEEDBACK_PATH = path

    const catalog = await loadMemeReviewCatalog()
    const scenarioSlug = catalog.scenarioSlugs.values().next().value
    if (!scenarioSlug)
      throw new Error('Expected at least one featured scenario')

    for (const disabled of [true, false]) {
      const response = await PATCH(
        new Request('http://localhost/api/meme-feedback', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            round: catalog.activeBatch,
            scenarioUpdates: [{ scenarioSlug, disabled }]
          })
        })
      )

      expect(response.status).toBe(200)
    }

    expect(await readMemeReviewState(path, catalog.activeBatch)).toMatchObject({
      scenarios: {}
    })
  })
})

function patchIdea(
  round: number,
  ideaId: string,
  feedback: {
    readonly rating: 'like'
    readonly notes: string
    readonly locked?: boolean
  },
  expectedFeedback?: MemeFeedbackEntry,
  targetRevisionKey?: string,
  expectedPayloadFingerprint?: string
) {
  return PATCH(
    new Request('http://localhost/api/meme-feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round,
        ideaUpdates: [
          {
            ideaId,
            feedback,
            expectedFeedback,
            targetRevisionKey,
            expectedPayloadFingerprint
          }
        ]
      })
    })
  )
}

function fingerprintFor(catalog: MemeReviewCatalog, ideaId: string) {
  for (const source of catalog.sources) {
    for (const scenario of source.scenarios) {
      const idea = scenario.ideas.find(({ id }) => id === ideaId)
      if (idea) return memeFinalizationFingerprint(idea, scenario.assets)
    }
  }

  throw new Error(`Missing meme idea ${ideaId}`)
}
