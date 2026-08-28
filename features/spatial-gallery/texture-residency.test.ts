import { describe, expect, it } from 'vitest'

import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

import {
  planTextureAdmission,
  rankNearbyItemIndices
} from './texture-residency'

const slots: readonly ProjectedSurfaceSlot[] = [
  { column: -2, itemIndex: 0, lane: 0, x: -4, y: 0 },
  { column: -1, itemIndex: 1, lane: 0, x: -2, y: 0 },
  { column: 0, itemIndex: 2, lane: 0, x: 0, y: 0 },
  { column: 1, itemIndex: 1, lane: 1, x: 2, y: 1 },
  { column: 2, itemIndex: 3, lane: 0, x: 4, y: 0 }
]

describe('spatial gallery texture residency', () => {
  it('keeps nearby records unique and prioritizes the incoming edge', () => {
    const positions = [-4, -1.8, 0.2, 1.9, 4]

    expect(rankNearbyItemIndices(slots, positions, 2, 10, 0.2)).toEqual([
      2, 1, 0
    ])
    expect(rankNearbyItemIndices(slots, positions, 2, -10, 0.2)).toEqual([
      2, 1, 3
    ])
  })

  it('admits, rejects, and evicts according to priority and recency', () => {
    expect([
      planTextureAdmission(
        [0, 1, 2],
        3,
        3,
        [3, 0, 1, 2],
        new Map([
          [0, 10],
          [1, 10],
          [2, 10]
        ])
      ),
      planTextureAdmission(
        [0, 1],
        2,
        2,
        [0, 1, 2],
        new Map([
          [0, 10],
          [1, 10]
        ])
      ),
      planTextureAdmission(
        [0, 1, 2],
        3,
        3,
        [3, 0],
        new Map([
          [0, 20],
          [1, 12],
          [2, 4]
        ])
      )
    ]).toEqual([
      { admit: true, evictItemIndex: 2 },
      { admit: false, evictItemIndex: null },
      { admit: true, evictItemIndex: 2 }
    ])
  })

  it('keeps residency hard-bounded through sustained admission', () => {
    const maximumResidentTextures = 64
    const resident = new Set<number>()
    const lastSeen = new Map<number, number>()

    for (
      let incomingItemIndex = 0;
      incomingItemIndex < maximumResidentTextures * 3;
      incomingItemIndex += 1
    ) {
      const admission = planTextureAdmission(
        resident,
        incomingItemIndex,
        maximumResidentTextures,
        [incomingItemIndex, ...resident].toReversed(),
        lastSeen
      )

      if (admission.evictItemIndex !== null) {
        resident.delete(admission.evictItemIndex)
      }
      if (admission.admit) {
        resident.add(incomingItemIndex)
        lastSeen.set(incomingItemIndex, incomingItemIndex)
      }

      expect(resident.size).toBeLessThanOrEqual(maximumResidentTextures)
    }

    expect(resident.size).toBe(maximumResidentTextures)
  })
})
