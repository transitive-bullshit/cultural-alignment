import type { MemeEvalFrameMode } from './schema'

export type PercentageRect = readonly [number, number, number, number]

export interface FrameFocus {
  readonly x: number
  readonly y: number
}

export interface FrameGeometry {
  readonly scale: number
  readonly renderedWidth: number
  readonly renderedHeight: number
  readonly imageLeft: number
  readonly imageTop: number
  readonly clipLeft: number
  readonly clipTop: number
  readonly clipRight: number
  readonly clipBottom: number
}

export function protectedRegionFocus(
  regions: readonly {
    readonly canvas_rect_pct: PercentageRect
    readonly priority: 'must' | 'soft'
  }[]
): FrameFocus {
  const mustRegions = regions.filter(({ priority }) => priority === 'must')
  const focusRegions = mustRegions.length ? mustRegions : regions
  if (!focusRegions.length) return { x: 50, y: 50 }

  let left = 100
  let top = 100
  let right = 0
  let bottom = 0
  for (const {
    canvas_rect_pct: [x, y, width, height]
  } of focusRegions) {
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x + width)
    bottom = Math.max(bottom, y + height)
  }
  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}

export function calculateFrameGeometry({
  sourceWidth,
  sourceHeight,
  targetLeft,
  targetTop,
  targetWidth,
  targetHeight,
  frameMode,
  focus = { x: 50, y: 50 }
}: {
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly targetLeft: number
  readonly targetTop: number
  readonly targetWidth: number
  readonly targetHeight: number
  readonly frameMode: MemeEvalFrameMode
  readonly focus?: FrameFocus
}): FrameGeometry {
  const cover = frameMode === 'cover'
  const scale = cover
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  return {
    scale,
    renderedWidth,
    renderedHeight,
    imageLeft: targetLeft + ((targetWidth - renderedWidth) * focus.x) / 100,
    imageTop: targetTop + ((targetHeight - renderedHeight) * focus.y) / 100,
    clipLeft: targetLeft,
    clipTop: targetTop,
    clipRight: targetLeft + targetWidth,
    clipBottom: targetTop + targetHeight
  }
}
