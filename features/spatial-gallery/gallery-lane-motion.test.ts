import { describe, expect, it } from 'vitest'

import {
  getGalleryLaneTargetXOffset,
  getGalleryLaneTargetY,
  getGalleryLaneWindowStart,
  isGalleryLaneActive,
  shouldRenderGalleryLane,
  stepGalleryLaneCount,
  syncGalleryTextureLaneMask
} from './gallery-lane-motion'

describe('gallery lane motion', () => {
  it('keeps the selected lane inside the smallest-churn active window', () => {
    expect(getGalleryLaneWindowStart(7, 5, 2, 0)).toBe(0)
    expect(getGalleryLaneWindowStart(7, 4, 2, 0)).toBe(0)
    expect(getGalleryLaneWindowStart(7, 4, 5, 0)).toBe(2)
    expect(getGalleryLaneWindowStart(7, 6, 5, 2)).toBe(1)
  })

  it.each([1, 2, 3, 4, 5, 6, 7])(
    'centers and orders a %s-row composition',
    (visibleLanes) => {
      const windowStart = Math.floor((7 - visibleLanes) / 2)
      const activeY = Array.from({ length: 7 }, (_, lane) => lane)
        .filter((lane) => isGalleryLaneActive(lane, windowStart, visibleLanes))
        .map((lane) =>
          getGalleryLaneTargetY(lane, windowStart, visibleLanes, 1.45, 10)
        )

      expect(activeY).toHaveLength(visibleLanes)
      expect(activeY[0]).toBeCloseTo(-activeY.at(-1)!)
      expect(activeY).toEqual(activeY.toSorted((left, right) => right - left))
      expect(activeY.includes(0)).toBe(visibleLanes % 2 === 1)
    }
  )

  it('keeps inactive lanes clipped and removes the fake center stagger for even rows', () => {
    expect(getGalleryLaneTargetY(0, 1, 4, 1.45, 5)).toBe(5)
    expect(getGalleryLaneTargetY(6, 1, 4, 1.45, 5)).toBe(-6.45)
    expect(
      [1, 2, 3, 4].map((lane) => getGalleryLaneTargetXOffset(lane, 1, 4, 0.28))
    ).toEqual([-0.28, 0.28, -0.28, 0.28])
  })

  it('advances a rendered composition by at most one row per frame', () => {
    expect(stepGalleryLaneCount(5, 2)).toBe(4)
    expect(stepGalleryLaneCount(2, 5)).toBe(3)
    expect(stepGalleryLaneCount(4, 4)).toBe(4)
  })

  it('renders exiting rows only until they reach their clipped resting point', () => {
    expect(shouldRenderGalleryLane(true, false, false)).toBe(true)
    expect(shouldRenderGalleryLane(false, false, true)).toBe(true)
    expect(shouldRenderGalleryLane(false, true, true)).toBe(false)
    expect(shouldRenderGalleryLane(false, false, false)).toBe(false)
  })

  it('prewarms target rows while retaining an outgoing rendered row', () => {
    const rendered = Uint8Array.from([1, 1, 1, 1, 1, 0, 0])
    const target = new Uint8Array(rendered.length)

    expect([...syncGalleryTextureLaneMask(target, rendered, 1, 5)]).toEqual([
      1, 1, 1, 1, 1, 1, 0
    ])
  })
})
