import { describe, expect, it } from 'vitest'

import {
  projectSourceRect,
  projectSourceRectWithVisibility
} from './project-geometry'

describe('archive protected-region projection', () => {
  it('accounts for horizontal cover cropping on a 16:9 source', () => {
    const projected = projectSourceRect({
      sourceRectPct: [0, 0, 25, 100],
      sourceWidth: 1600,
      sourceHeight: 900,
      template: 'overlay',
      frameMode: 'cover',
      frameIndex: 0
    })

    expect(projected?.[0]).toBe(0)
    expect(projected?.[1]).toBe(0)
    expect(projected?.[2]).toBeCloseTo(20.37, 1)
    expect(projected?.[3]).toBe(100)
  })

  it('clips cover-cropped regions to the sidecar image box', () => {
    const projected = projectSourceRect({
      sourceRectPct: [0, 0, 25, 100],
      sourceWidth: 1600,
      sourceHeight: 900,
      template: 'sidecar-left',
      frameMode: 'cover',
      frameIndex: 0
    })

    expect(projected?.[0]).toBeCloseTo(27.5, 1)
    expect(projected?.[0]).toBeGreaterThanOrEqual(27.5)
  })

  it('clips cover-cropped regions below a top band', () => {
    const projected = projectSourceRect({
      sourceRectPct: [0, 0, 100, 20],
      sourceWidth: 1600,
      sourceHeight: 900,
      template: 'band-top',
      frameMode: 'cover',
      frameIndex: 0
    })

    expect(projected?.[1]).toBeCloseTo(23.75, 1)
    expect(projected?.[1]).toBeGreaterThanOrEqual(23.75)
  })

  it('accounts for contain letterboxing and a top band', () => {
    const projected = projectSourceRect({
      sourceRectPct: [0, 0, 100, 100],
      sourceWidth: 1200,
      sourceHeight: 800,
      template: 'band-top',
      frameMode: 'contain',
      frameIndex: 0
    })

    expect(projected?.[0]).toBeCloseTo(11.88, 1)
    expect(projected?.[1]).toBeCloseTo(23.75, 1)
    expect(projected?.[2]).toBeCloseTo(76.25, 1)
    expect(projected?.[3]).toBeCloseTo(76.25, 1)
  })

  it('places ordered diptych frames in separate canvas halves', () => {
    const left = projectSourceRect({
      sourceRectPct: [0, 0, 100, 100],
      sourceWidth: 600,
      sourceHeight: 800,
      template: 'diptych',
      frameMode: 'cover',
      frameIndex: 0
    })
    const right = projectSourceRect({
      sourceRectPct: [0, 0, 100, 100],
      sourceWidth: 600,
      sourceHeight: 800,
      template: 'diptych',
      frameMode: 'cover',
      frameIndex: 1
    })

    expect(left).toEqual([0, 0, 50, 100])
    expect(right).toEqual([50, 0, 50, 100])
  })

  it('reports when a focused locked cover still clips a must region', () => {
    const projection = projectSourceRectWithVisibility({
      sourceRectPct: [90, 0, 10, 100],
      sourceWidth: 1600,
      sourceHeight: 900,
      template: 'overlay',
      frameMode: 'cover',
      frameIndex: 0,
      focus: { x: 50, y: 50 }
    })

    expect(projection.rect).not.toBeNull()
    expect(projection.visibleRatio).toBeGreaterThan(0)
    expect(projection.visibleRatio).toBeLessThan(1)
  })
})
