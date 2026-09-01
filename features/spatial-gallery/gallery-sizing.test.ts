import { describe, expect, it } from 'vitest'

import {
  GALLERY_ITEM_SIZE_DEFAULT,
  GALLERY_ITEM_SIZE_MAX,
  GALLERY_ITEM_SIZE_MIN,
  getGalleryViewportMetrics,
  normalizeGalleryItemSize,
  parseStoredGalleryItemSize
} from './gallery-sizing'

describe('gallery item-size preference', () => {
  it.each([
    null,
    '',
    'not-a-number',
    'Infinity',
    String(GALLERY_ITEM_SIZE_MIN - 1),
    String(GALLERY_ITEM_SIZE_MAX + 1)
  ])('falls back for an invalid stored value: %s', (value) => {
    expect(parseStoredGalleryItemSize(value)).toBe(GALLERY_ITEM_SIZE_DEFAULT)
  })

  it('clamps and step-normalizes live values', () => {
    expect(normalizeGalleryItemSize(GALLERY_ITEM_SIZE_MIN - 20)).toBe(
      GALLERY_ITEM_SIZE_MIN
    )
    expect(normalizeGalleryItemSize(83)).toBe(85)
    expect(normalizeGalleryItemSize(GALLERY_ITEM_SIZE_MAX + 20)).toBe(
      GALLERY_ITEM_SIZE_MAX
    )
  })

  it('restores valid stored values to the nearest supported step', () => {
    expect(parseStoredGalleryItemSize('117')).toBe(115)
    expect(parseStoredGalleryItemSize('120')).toBe(120)
  })
})

describe('gallery density projection', () => {
  const viewport = { height: 782, width: 1_440 }
  const compact = getGalleryViewportMetrics(
    false,
    viewport.width,
    viewport.height,
    GALLERY_ITEM_SIZE_MIN
  )
  const standard = getGalleryViewportMetrics(
    false,
    viewport.width,
    viewport.height,
    GALLERY_ITEM_SIZE_DEFAULT
  )
  const expanded = getGalleryViewportMetrics(
    false,
    viewport.width,
    viewport.height,
    GALLERY_ITEM_SIZE_MAX
  )

  it('keeps the current five-lane composition as the default', () => {
    expect(standard.lanes).toBe(5)
  })

  it('reflows the field as frames become smaller or larger', () => {
    expect([compact.lanes, standard.lanes, expanded.lanes]).toEqual([7, 5, 2])
    expect(compact.frameWidthPixels).toBeLessThan(standard.frameWidthPixels)
    expect(standard.frameWidthPixels).toBeLessThan(expanded.frameWidthPixels)
  })

  it('uses each fully fitting desktop row count instead of skipping even counts', () => {
    expect(
      Array.from({ length: 27 }, (_, index) =>
        getGalleryViewportMetrics(
          false,
          viewport.width,
          viewport.height,
          GALLERY_ITEM_SIZE_MIN + index * 5
        )
      ).map(({ lanes }) => lanes)
    ).toEqual([
      7, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2,
      2, 2
    ])
  })

  it('scales the row and column spacing in proportion with each frame', () => {
    expect(compact.rowPitchPixels / compact.frameWidthPixels).toBeCloseTo(
      standard.rowPitchPixels / standard.frameWidthPixels
    )
    expect(expanded.rowPitchPixels / expanded.frameWidthPixels).toBeCloseTo(
      standard.rowPitchPixels / standard.frameWidthPixels
    )
    expect(compact.columnPitchPixels / compact.frameWidthPixels).toBeCloseTo(
      standard.columnPitchPixels / standard.frameWidthPixels
    )
    expect(expanded.columnPitchPixels / expanded.frameWidthPixels).toBeCloseTo(
      standard.columnPitchPixels / standard.frameWidthPixels
    )
  })

  it('allows more rows as frames become smaller on a phone layout', () => {
    const compactPhone = getGalleryViewportMetrics(
      true,
      390,
      740,
      GALLERY_ITEM_SIZE_MIN
    )
    const standardPhone = getGalleryViewportMetrics(
      true,
      390,
      740,
      GALLERY_ITEM_SIZE_DEFAULT
    )

    expect(compactPhone.lanes).toBe(5)
    expect(standardPhone.lanes).toBe(4)
  })

  it('steps through every fully fitting mobile row count', () => {
    const metrics = Array.from({ length: 27 }, (_, index) =>
      getGalleryViewportMetrics(true, 375, 605, 70 + index * 5)
    )
    const laneCounts = metrics.map(({ lanes }) => lanes)

    expect([...new Set(laneCounts)]).toEqual([5, 4, 3, 2, 1])
    expect(
      laneCounts.every(
        (lanes, index) =>
          index === 0 || Math.abs(lanes - laneCounts[index - 1]!) <= 1
      )
    ).toBe(true)
    expect(
      metrics.every(({ compositionHeightPixels }) =>
        Number.isFinite(compositionHeightPixels)
      )
    ).toBe(true)
    expect(
      metrics.every(
        ({ compositionHeightPixels }) => compositionHeightPixels <= 605
      )
    ).toBe(true)
  })

  it.each([
    { height: 605, width: 375 },
    { height: 313, width: 667 }
  ])(
    'never counts clipped rows in a short $width×$height mobile field',
    ({ height, width }) => {
      const metrics = getGalleryViewportMetrics(
        true,
        width,
        height,
        GALLERY_ITEM_SIZE_MAX
      )

      expect(metrics.lanes).toBe(1)
      expect(metrics.compositionHeightPixels).toBeLessThanOrEqual(height)
    }
  )
})
