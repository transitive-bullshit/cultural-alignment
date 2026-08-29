import { describe, expect, it } from 'vitest'

import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

import {
  getTextureBindingLimit,
  planTextureBindings,
  planTextureLoads,
  prioritizeTextureItemIndices,
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
  it.each([
    [390, 128],
    [680, 128],
    [681, 256],
    [1_440, 256]
  ])(
    'uses a %i pixel viewport to select a %i texture GPU binding limit',
    (viewportWidth, expectedLimit) => {
      expect(getTextureBindingLimit(viewportWidth)).toBe(expectedLimit)
    }
  )

  it('keeps the highest-priority full textures bound within the GPU limit', () => {
    const fullItemIndices = new Set([0, 1, 2, 3, 4])
    const residentItemIndices = new Set(fullItemIndices)

    expect(
      planTextureBindings({
        boundItemIndices: new Set([0, 1, 2]),
        fullItemIndices,
        maximumBoundTextures: 3,
        prioritizedItemIndices: [3, 0, 1, 2, 4],
        residentItemIndices
      })
    ).toEqual({
      bindItemIndices: [3],
      evictItemIndices: [2]
    })
    expect(fullItemIndices).toEqual(new Set([0, 1, 2, 3, 4]))
    expect(residentItemIndices).toEqual(new Set([0, 1, 2, 3, 4]))
  })

  it('prioritizes visible items, then the incoming edge, then idle gallery work', () => {
    const positions = [-4, -1.8, 0.2, 1.9, 4]

    expect(prioritizeTextureItemIndices(slots, positions, 2, 10, 0.2)).toEqual({
      foregroundItemIndices: [2, 1, 0],
      idleItemIndices: [3]
    })
    expect(prioritizeTextureItemIndices(slots, positions, 2, -10, 0.2)).toEqual(
      {
        foregroundItemIndices: [2, 1, 3],
        idleItemIndices: [0]
      }
    )
  })

  it('loads embedded placeholders and full textures in parallel without duplicating resident work', () => {
    expect(
      planTextureLoads({
        failedFull: new Set<number>(),
        failedPlaceholder: new Set<number>(),
        full: new Set([2]),
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
        pendingFull: new Set([0]),
        pendingPlaceholder: new Set([0]),
        prioritizedItemIndices: [0, 1, 2, 3],
        resident: new Set([1, 2]),
        fullLoadCapacity: 2,
        placeholderLoadCapacity: 2
      })
    ).toEqual({
      fullItemIndices: [1, 3],
      placeholderItemIndices: [3]
    })
  })

  it('bounds parallel work to the configured capacities', () => {
    const prioritizedItemIndices = Array.from(
      { length: 100 },
      (_, itemIndex) => itemIndex
    )
    const plan = planTextureLoads({
      failedFull: new Set<number>(),
      failedPlaceholder: new Set<number>(),
      full: new Set<number>(),
      fullLoadCapacity: 32,
      pendingFull: new Set<number>(),
      pendingPlaceholder: new Set<number>(),
      placeholderLoadCapacity: 4,
      prioritizedItemIndices,
      resident: new Set<number>()
    })

    expect(plan.fullItemIndices).toHaveLength(32)
    expect(plan.placeholderItemIndices).toHaveLength(4)
    expect(
      plan.fullItemIndices.length + plan.placeholderItemIndices.length
    ).toBeLessThanOrEqual(36)
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
          onBind: (texture) => bound.push(texture),
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

  it('keeps a completed full texture resident after its item leaves the active range', () => {
    const disposed: string[] = []
    const fullItemIndices = new Set<number>()
    const residentTextures = new Map<number, string>()

    expect(
      settleTextureLoad({
        activeItemIndices: new Set<number>(),
        current: true,
        dispose: (texture) => disposed.push(texture),
        fullItemIndices,
        itemIndex: 0,
        onBind: () => undefined,
        residentTextures,
        stage: 'full',
        texture: 'full'
      })
    ).toBe(true)
    expect(disposed).toEqual([])
    expect(residentTextures).toEqual(new Map([[0, 'full']]))
    expect(fullItemIndices).toEqual(new Set([0]))
  })
})
