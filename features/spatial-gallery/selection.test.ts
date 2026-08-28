import { describe, expect, it } from 'vitest'

import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

import {
  DIMMED_ACTIVITY,
  getSlotActivityTarget,
  getSlotScaleTarget,
  resolveWarpedPointerSlot,
  resolveVisualSlotIndex
} from './selection'

const repeatedSlots: readonly ProjectedSurfaceSlot[] = [
  { column: -1, itemIndex: 3, lane: 0, x: -2, y: 0 },
  { column: 0, itemIndex: 3, lane: 1, x: 0, y: 1 },
  { column: 1, itemIndex: 7, lane: 0, x: 2, y: 0 }
]

describe('spatial gallery instance selection', () => {
  it('makes only the exact active slot vivid when an item is repeated', () => {
    const activeSlotIndex = resolveVisualSlotIndex(
      { itemIndex: 3, slotIndex: 1 },
      repeatedSlots
    )

    expect(
      repeatedSlots.map((_, slotIndex) =>
        getSlotActivityTarget(slotIndex, activeSlotIndex)
      )
    ).toEqual([DIMMED_ACTIVITY, 1, DIMMED_ACTIVITY])
  })

  it('rejects a stale slot whose item identity changed at the wrap seam', () => {
    expect(
      resolveVisualSlotIndex({ itemIndex: 7, slotIndex: 1 }, repeatedSlots)
    ).toBeNull()
  })

  it('keeps reduced-motion hover emphasis free of scale transforms', () => {
    expect(getSlotScaleTarget(true, false, 1.045)).toBe(1.045)
    expect(getSlotScaleTarget(true, true, 1.045)).toBe(1)
    expect(getSlotScaleTarget(false, false, 1.045)).toBe(1)
  })

  it('hits the rendered edge card instead of its stale unwarped plane', () => {
    const edgeSlot: readonly ProjectedSurfaceSlot[] = [
      { column: 2, itemIndex: 4, lane: 0, x: 4, y: 0 }
    ]
    const sharedOptions = {
      frameHeight: 1,
      frameWidth: 2,
      rowGap: 1,
      scales: [1],
      slots: edgeSlot,
      viewportAspect: 2,
      viewportWidth: 10,
      warpSpeed: 1,
      xPositions: [4]
    } as const

    expect(
      resolveWarpedPointerSlot({
        ...sharedOptions,
        pointerNdc: { x: 0.8, y: 0.32 }
      })
    ).toEqual({ itemIndex: 4, slotIndex: 0 })
    expect(
      resolveWarpedPointerSlot({
        ...sharedOptions,
        pointerNdc: { x: 0.8, y: 0 }
      })
    ).toBeNull()
  })

  it('adds hit tolerance without changing the projected card geometry', () => {
    const centerSlot: readonly ProjectedSurfaceSlot[] = [
      { column: 0, itemIndex: 2, lane: 0, x: 0, y: 0 }
    ]
    const sharedOptions = {
      frameHeight: 1,
      frameWidth: 2,
      pointerNdc: { x: 0.21, y: 0 },
      rowGap: 1,
      scales: [1],
      slots: centerSlot,
      viewportAspect: 2,
      viewportWidth: 10,
      warpSpeed: 0,
      xPositions: [0]
    } as const

    expect(resolveWarpedPointerSlot(sharedOptions)).toBeNull()
    expect(
      resolveWarpedPointerSlot({ ...sharedOptions, hitPadding: 0.1 })
    ).toEqual({ itemIndex: 2, slotIndex: 0 })
  })

  it('resolves padded overlap to the nearest projected instance', () => {
    const closeSlots: readonly ProjectedSurfaceSlot[] = [
      { column: 0, itemIndex: 2, lane: 0, x: -0.5, y: 0 },
      { column: 1, itemIndex: 2, lane: 0, x: 0.5, y: 0 }
    ]

    expect(
      resolveWarpedPointerSlot({
        frameHeight: 1,
        frameWidth: 1,
        hitPadding: 0.3,
        pointerNdc: { x: 0.02, y: 0 },
        rowGap: 1,
        scales: [1, 1],
        slots: closeSlots,
        viewportAspect: 2,
        viewportWidth: 10,
        warpSpeed: 0,
        xPositions: [-0.5, 0.5]
      })
    ).toEqual({ itemIndex: 2, slotIndex: 1 })
  })
})
