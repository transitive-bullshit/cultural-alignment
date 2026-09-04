import { describe, expect, it } from 'vitest'

import { loadMemeReviewCatalog } from '../lib/meme-review/catalog'
import type {
  MemeFeedbackEntry,
  MemeReviewStateDocument
} from '../lib/meme-review/schema'
import {
  migrationPatchFor,
  planMemeFinalizationMigration
} from './finalize-reverted-meme-versions'

describe('reverted meme version finalization migration', () => {
  it('selects exact revert notes and legacy locks while preserving feedback', async () => {
    const catalog = await loadMemeReviewCatalog()
    const ideaIds = Object.entries(catalog.historyByIdeaId)
      .filter(([, entries]) =>
        entries.some(({ revisionKey }) => revisionKey === 'round-01')
      )
      .slice(0, 4)
      .map(([ideaId]) => ideaId)

    if (ideaIds.length < 4) {
      throw new Error('Expected four active meme ideas with round-one history')
    }

    const revertIdeaId = ideaIds[0]!
    const neutralIdeaId = ideaIds[1]!
    const inflectedIdeaId = ideaIds[2]!
    const legacyIdeaId = ideaIds[3]!
    const revertFeedback = feedback({
      rating: 'like',
      notes: 'Please REVERT to the previous version.'
    })
    const neutralFeedback = feedback({
      rating: 'neutral',
      notes: 'revert this one'
    })
    const inflectedFeedback = feedback({
      rating: 'like',
      notes: 'This was already reverted.'
    })
    const legacyFeedback = feedback({
      rating: 'like',
      notes: 'Approved before version pointers existed.',
      locked: true,
      lockRevision: 3
    })
    const state = stateFor(catalog.activeBatch, {
      [revertIdeaId]: revertFeedback,
      [neutralIdeaId]: neutralFeedback,
      [inflectedIdeaId]: inflectedFeedback,
      [legacyIdeaId]: legacyFeedback
    })

    const plan = planMemeFinalizationMigration(catalog, state)

    expect(plan).toMatchObject({
      scannedFeedbackCount: 4,
      revertNoteCount: 2,
      actions: expect.arrayContaining([
        expect.objectContaining({
          kind: 'finalize-reverted-version',
          ideaId: revertIdeaId,
          expectedFeedback: revertFeedback,
          targetRevisionKey: 'round-01'
        }),
        expect.objectContaining({
          kind: 'materialize-legacy-finalization',
          ideaId: legacyIdeaId,
          expectedFeedback: legacyFeedback,
          targetRevisionKey: catalog.activeRevisionKey
        })
      ]),
      skipped: [
        {
          ideaId: neutralIdeaId,
          reason: 'rating is neutral, not like'
        }
      ]
    })
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedPayloadFingerprint: expect.stringMatching(
            /^v1-[a-f0-9]{16}-\d+$/
          )
        })
      ])
    )

    const patch = migrationPatchFor(plan)
    const revertUpdate = patch.ideaUpdates.find(
      ({ ideaId }) => ideaId === revertIdeaId
    )
    const legacyUpdate = patch.ideaUpdates.find(
      ({ ideaId }) => ideaId === legacyIdeaId
    )
    expect(patch.ideaUpdates).toHaveLength(2)
    expect(revertUpdate).toMatchObject({
      feedback: {
        rating: revertFeedback.rating,
        notes: revertFeedback.notes,
        locked: true
      },
      expectedFeedback: revertFeedback
    })
    expect(legacyUpdate).toMatchObject({
      feedback: {
        rating: legacyFeedback.rating,
        notes: legacyFeedback.notes,
        locked: true
      },
      expectedFeedback: legacyFeedback
    })
    expect(plan.actions.some(({ ideaId }) => ideaId === inflectedIdeaId)).toBe(
      false
    )
  })

  it('skips a revert request whose required previous revision is missing', async () => {
    const catalog = await loadMemeReviewCatalog()
    const ideaId = catalog.ideaIds.values().next().value
    if (!ideaId) throw new Error('Expected an active meme idea')

    const plan = planMemeFinalizationMigration(
      {
        ...catalog,
        historyByIdeaId: { ...catalog.historyByIdeaId, [ideaId]: [] }
      },
      stateFor(catalog.activeBatch, {
        [ideaId]: feedback({
          rating: 'like',
          notes: 'revert to the previous layout'
        })
      })
    )

    expect(plan.actions).toEqual([])
    expect(plan.skipped).toEqual([
      {
        ideaId,
        reason: 'previous revision round-01 is missing'
      }
    ])
  })
})

function feedback({
  rating,
  notes,
  locked = false,
  lockRevision = 0
}: Pick<MemeFeedbackEntry, 'rating' | 'notes'> &
  Partial<
    Pick<MemeFeedbackEntry, 'locked' | 'lockRevision'>
  >): MemeFeedbackEntry {
  return { rating, notes, locked, lockRevision }
}

function stateFor(
  round: number,
  feedback: Readonly<Record<string, MemeFeedbackEntry>>
): MemeReviewStateDocument {
  return {
    version: 2,
    round,
    updatedAt: null,
    feedback: { ...feedback },
    scenarios: {}
  }
}
