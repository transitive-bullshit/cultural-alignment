import { describe, expect, it } from 'vitest'

import { calculateFrameGeometry, protectedRegionFocus } from './frame-geometry'

describe('meme frame geometry', () => {
  it('matches the archive renderer focus derived from must-region union', () => {
    expect(
      protectedRegionFocus([
        { canvas_rect_pct: [10, 20, 20, 30], priority: 'must' },
        { canvas_rect_pct: [70, 40, 20, 40], priority: 'must' },
        { canvas_rect_pct: [0, 0, 5, 5], priority: 'soft' }
      ])
    ).toEqual({ x: 50, y: 50 })
  })

  it('moves an overflowing cover crop toward an off-center focus', () => {
    const geometry = calculateFrameGeometry({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetLeft: 0,
      targetTop: 0,
      targetWidth: 1200,
      targetHeight: 800,
      frameMode: 'cover',
      focus: { x: 80, y: 50 }
    })

    expect(geometry.imageLeft).toBeCloseTo(-177.78, 1)
    expect(geometry.imageTop).toBe(0)
  })
})
