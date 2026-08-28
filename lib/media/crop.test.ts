import { describe, expect, it } from 'vitest'

import { calculateCoverCrop, focalPointToObjectPosition } from './crop'

describe('cover crop math', () => {
  it('preserves a 3:2 image without translating an equivalent frame', () => {
    expect(
      calculateCoverCrop({
        sourceWidth: 1920,
        sourceHeight: 1280,
        frameWidth: 600,
        frameHeight: 400,
        focalPoint: { x: 0.56, y: 0.48 }
      })
    ).toMatchObject({
      scale: 0.3125,
      renderedWidth: 600,
      renderedHeight: 400,
      translateX: 0,
      translateY: 0,
      objectPosition: '50% 50%'
    })
  })

  it('keeps the authored focal point visible and clamps crop edges', () => {
    const crop = calculateCoverCrop({
      sourceWidth: 1600,
      sourceHeight: 900,
      frameWidth: 400,
      frameHeight: 400,
      focalPoint: { x: 0.85, y: 0.5 }
    })

    expect(crop.renderedWidth).toBeCloseTo(711.1111, 3)
    expect(crop.translateX).toBeCloseTo(-311.1111, 3)
    expect(crop.translateY).toBe(0)
    expect(crop.objectPosition).toBe('100% 50%')
  })

  it('uses one normalized focal point string across gallery and detail', () => {
    expect(focalPointToObjectPosition({ x: 0.56, y: 0.48 })).toBe('56% 48%')
    expect(focalPointToObjectPosition(undefined)).toBe('50% 50%')
  })

  it('rejects zero dimensions and invalid focal points', () => {
    expect(() =>
      calculateCoverCrop({
        sourceWidth: 0,
        sourceHeight: 900,
        frameWidth: 400,
        frameHeight: 400
      })
    ).toThrow(RangeError)
    expect(() => focalPointToObjectPosition({ x: 1.1, y: 0.5 })).toThrow(
      RangeError
    )
  })
})
