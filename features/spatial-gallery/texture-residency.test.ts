import { describe, expect, it } from 'vitest'

import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

import {
  planTextureLoads,
  planTextureAdmission,
  rankNearbyItemIndices,
  settleTextureLoad,
  type TextureLoadStage
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

  it('loads embedded placeholders and full textures in parallel without duplicating resident work', () => {
    expect(
      planTextureLoads({
        failedFull: new Set<number>(),
        failedPlaceholder: new Set<number>(),
        full: new Set([2]),
        maximumResidentTextures: 4,
        pendingFull: new Set<number>(),
        pendingPlaceholder: new Set<number>(),
        prioritizedItemIndices: [0, 1, 2, 3],
        resident: new Set([1, 2]),
        fullLoadCapacity: 2,
        placeholderLoadCapacity: 2
      })
    ).toEqual({
      fullItemIndices: [0, 1],
      placeholderItemIndices: [0, 3]
    })

    expect(
      planTextureLoads({
        failedFull: new Set<number>(),
        failedPlaceholder: new Set<number>(),
        full: new Set([2]),
        maximumResidentTextures: 3,
        pendingFull: new Set([0]),
        pendingPlaceholder: new Set([0]),
        prioritizedItemIndices: [0, 1, 2, 3],
        resident: new Set([1, 2]),
        fullLoadCapacity: 2,
        placeholderLoadCapacity: 2
      })
    ).toEqual({
      fullItemIndices: [1],
      placeholderItemIndices: []
    })
  })

  it('bounds parallel work to the configured capacities and residency window', () => {
    const prioritizedItemIndices = Array.from(
      { length: 100 },
      (_, itemIndex) => itemIndex
    )
    const plan = planTextureLoads({
      failedFull: new Set<number>(),
      failedPlaceholder: new Set<number>(),
      full: new Set<number>(),
      fullLoadCapacity: 12,
      maximumResidentTextures: 64,
      pendingFull: new Set<number>(),
      pendingPlaceholder: new Set<number>(),
      placeholderLoadCapacity: 4,
      prioritizedItemIndices,
      resident: new Set<number>()
    })

    expect(plan.fullItemIndices).toHaveLength(12)
    expect(plan.placeholderItemIndices).toHaveLength(4)
    expect(
      [...plan.fullItemIndices, ...plan.placeholderItemIndices].every(
        (itemIndex) => itemIndex < 64
      )
    ).toBe(true)
    expect(
      plan.fullItemIndices.length + plan.placeholderItemIndices.length
    ).toBeLessThanOrEqual(16)
  })

  it.each([
    ['placeholder', 'full'],
    ['full', 'placeholder']
  ] satisfies readonly (readonly [TextureLoadStage, TextureLoadStage])[])(
    'keeps the full texture when %s resolves before %s',
    (firstStage, secondStage) => {
      const activeItemIndices = new Set([0])
      const disposed: string[] = []
      const bound: string[] = []
      const fullItemIndices = new Set<number>()
      const residentTextures = new Map<number, string>()

      const settle = (stage: TextureLoadStage) =>
        settleTextureLoad({
          activeItemIndices,
          current: true,
          dispose: (texture) => disposed.push(texture),
          fullItemIndices,
          itemIndex: 0,
          lastSeen: new Map([[0, 1]]),
          maximumResidentTextures: 1,
          onBind: (texture) => bound.push(texture),
          onEvict: () => undefined,
          prioritizedItemIndices: [0],
          residentTextures,
          stage,
          texture: stage
        })

      settle(firstStage)
      settle(secondStage)

      expect(residentTextures.get(0)).toBe('full')
      expect(bound.at(-1)).toBe('full')
      expect(fullItemIndices).toEqual(new Set([0]))
      expect(disposed).toContain('placeholder')
    }
  )

  it('disposes a completed texture after its item leaves the active range', () => {
    const disposed: string[] = []
    const residentTextures = new Map<number, string>()

    expect(
      settleTextureLoad({
        activeItemIndices: new Set<number>(),
        current: true,
        dispose: (texture) => disposed.push(texture),
        fullItemIndices: new Set<number>(),
        itemIndex: 0,
        lastSeen: new Map<number, number>(),
        maximumResidentTextures: 1,
        onBind: () => undefined,
        onEvict: () => undefined,
        prioritizedItemIndices: [],
        residentTextures,
        stage: 'placeholder',
        texture: 'placeholder'
      })
    ).toBe(false)
    expect(disposed).toEqual(['placeholder'])
    expect(residentTextures.size).toBe(0)
  })
})
