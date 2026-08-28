import { describe, expect, it } from 'vitest'

import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

import {
  collectNearbyItemIndices,
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

describe('spatial gallery texture residency candidates', () => {
  it('selects unique near-visible records from live wrapped positions', () => {
    const target = new Set([99])

    expect(
      new Set(
        collectNearbyItemIndices(slots, [-4, -1.8, 0.2, 1.9, 4], 2, target)
      )
    ).toEqual(new Set([1, 2]))
    expect(target.has(99)).toBe(false)
  })

  it('reuses the provided set as the surface advances', () => {
    const target = collectNearbyItemIndices(
      slots,
      [-4, -1.8, 0.2, 1.9, 4],
      2,
      new Set<number>()
    )
    const next = collectNearbyItemIndices(
      slots,
      [-1.5, 2.5, 4, -4, 0.5],
      2,
      target
    )

    expect(next).toBe(target)
    expect(new Set(next)).toEqual(new Set([0, 3]))
  })

  it('preloads only the incoming edge in the direction of travel', () => {
    const positions = [-4, -1.8, 0.2, 1.9, 4]

    expect(
      new Set(
        collectNearbyItemIndices(
          slots,
          positions,
          2,
          new Set<number>(),
          10,
          0.2
        )
      )
    ).toEqual(new Set([0, 1, 2]))
    expect(
      new Set(
        collectNearbyItemIndices(
          slots,
          positions,
          2,
          new Set<number>(),
          -10,
          0.2
        )
      )
    ).toEqual(new Set([1, 2, 3]))
  })

  it('prioritizes current center cards before directional lookahead cards', () => {
    expect(
      rankNearbyItemIndices(slots, [-4, -1.8, 0.2, 1.9, 4], 2, 10, 0.2)
    ).toEqual([2, 1, 0])
    expect(
      rankNearbyItemIndices(slots, [-4, -1.8, 0.2, 1.9, 4], 2, -10, 0.2)
    ).toEqual([2, 1, 3])
  })

  it('admits higher-priority textures by evicting the lowest-priority resident', () => {
    expect(
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
      )
    ).toEqual({ admit: true, evictItemIndex: 2 })
  })

  it('rejects an incoming texture when every capped resident has higher priority', () => {
    expect(
      planTextureAdmission(
        [0, 1],
        2,
        2,
        [0, 1, 2],
        new Map([
          [0, 10],
          [1, 10]
        ])
      )
    ).toEqual({ admit: false, evictItemIndex: null })
  })

  it('uses least-recently-seen order for residents outside the active priority window', () => {
    expect(
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
    ).toEqual({ admit: true, evictItemIndex: 2 })
  })

  it('keeps residency hard-bounded through a long sequence of incoming records', () => {
    const maximumResidentTextures = 64
    const resident = new Set<number>()
    const lastSeen = new Map<number, number>()

    for (
      let incomingItemIndex = 0;
      incomingItemIndex < 179;
      incomingItemIndex += 1
    ) {
      const existingByRecency = [...resident].toReversed()
      const priorities = [incomingItemIndex, ...existingByRecency]
      const admission = planTextureAdmission(
        resident,
        incomingItemIndex,
        maximumResidentTextures,
        priorities,
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
