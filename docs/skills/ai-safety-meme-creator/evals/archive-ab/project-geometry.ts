import sharp from 'sharp'

import {
  calculateFrameGeometry,
  protectedRegionFocus,
  type FrameFocus
} from '../frame-geometry'
import { memeEvalCanvas } from '../render'
import type { MemeEvalPlan, MemeSkillFixture } from '../schema'

type Rect = readonly [number, number, number, number]

export interface SourceRectProjection {
  readonly rect: Rect | null
  readonly visibleRatio: number
}

export async function projectArchiveFixtureForPlan(
  fixture: MemeSkillFixture,
  plan: MemeEvalPlan
): Promise<{
  readonly fixture: MemeSkillFixture
  readonly visibilityViolations: readonly string[]
}> {
  const visibleFrames =
    plan.presentation.template === 'diptych'
      ? plan.presentation.source_frames
      : plan.presentation.source_frames.slice(0, 1)
  const frameIndexByImageId = new Map(
    visibleFrames.map(({ image_id }, index) => [image_id, index])
  )
  const dimensions = new Map<string, { width: number; height: number }>()
  const focusByImageId = new Map(
    fixture.images.map(({ id }) => [
      id,
      protectedRegionFocus(
        fixture.protected_regions.filter(({ image_id }) => image_id === id)
      )
    ])
  )
  await Promise.all(
    fixture.images.map(async ({ id, path }) => {
      const metadata = await sharp(path).metadata()
      if (!metadata.width || !metadata.height) {
        throw new Error(`Could not read source dimensions for ${id}`)
      }
      dimensions.set(id, { width: metadata.width, height: metadata.height })
    })
  )

  const visibilityViolations: string[] = []
  const protectedRegions = fixture.protected_regions.flatMap((region) => {
    const frameIndex = frameIndexByImageId.get(region.image_id)
    if (frameIndex === undefined) return []
    const source = dimensions.get(region.image_id)!
    const projection = projectSourceRectWithVisibility({
      sourceRectPct: region.canvas_rect_pct,
      sourceWidth: source.width,
      sourceHeight: source.height,
      template: plan.presentation.template,
      frameMode: plan.presentation.frame_mode,
      frameIndex,
      focus: focusByImageId.get(region.image_id)
    })
    if (region.priority === 'must' && projection.visibleRatio < 0.995) {
      visibilityViolations.push(
        `${region.label} is ${Math.round(projection.visibleRatio * 100)}% visible after the locked ${plan.presentation.frame_mode} crop`
      )
    }
    return projection.rect
      ? [
          {
            ...region,
            canvas_rect_pct: projection.rect as [number, number, number, number]
          }
        ]
      : []
  })

  return {
    fixture: { ...fixture, protected_regions: protectedRegions },
    visibilityViolations
  }
}

export function projectSourceRect({
  sourceRectPct,
  sourceWidth,
  sourceHeight,
  template,
  frameMode,
  frameIndex,
  focus
}: {
  readonly sourceRectPct: Rect
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly template: MemeEvalPlan['presentation']['template']
  readonly frameMode: MemeEvalPlan['presentation']['frame_mode']
  readonly frameIndex: number
  readonly focus?: FrameFocus
}): Rect | null {
  return projectSourceRectWithVisibility({
    sourceRectPct,
    sourceWidth,
    sourceHeight,
    template,
    frameMode,
    frameIndex,
    focus
  }).rect
}

export function projectSourceRectWithVisibility({
  sourceRectPct,
  sourceWidth,
  sourceHeight,
  template,
  frameMode,
  frameIndex,
  focus
}: {
  readonly sourceRectPct: Rect
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly template: MemeEvalPlan['presentation']['template']
  readonly frameMode: MemeEvalPlan['presentation']['frame_mode']
  readonly frameIndex: number
  readonly focus?: FrameFocus
}): SourceRectProjection {
  const { width: canvasWidth, height: canvasHeight } = memeEvalCanvas
  const diptych = template === 'diptych'
  const bandHeight =
    template === 'band-top' || template === 'band-bottom' ? 190 : 0
  const sidecarWidth =
    template === 'sidecar-left' || template === 'sidecar-right' ? 330 : 0
  const targetWidth = diptych ? canvasWidth / 2 : canvasWidth - sidecarWidth
  const targetHeight = diptych ? canvasHeight : canvasHeight - bandHeight
  const targetLeft = diptych
    ? frameIndex * targetWidth
    : template === 'sidecar-left'
      ? sidecarWidth
      : 0
  const targetTop = template === 'band-top' ? bandHeight : 0
  const geometry = calculateFrameGeometry({
    sourceWidth,
    sourceHeight,
    targetLeft,
    targetTop,
    targetWidth,
    targetHeight,
    frameMode,
    focus
  })
  const [xPct, yPct, widthPct, heightPct] = sourceRectPct
  const rawLeft =
    geometry.imageLeft + (xPct / 100) * sourceWidth * geometry.scale
  const rawTop =
    geometry.imageTop + (yPct / 100) * sourceHeight * geometry.scale
  const rawRight = rawLeft + (widthPct / 100) * sourceWidth * geometry.scale
  const rawBottom = rawTop + (heightPct / 100) * sourceHeight * geometry.scale
  const left = clamp(rawLeft, geometry.clipLeft, geometry.clipRight)
  const top = clamp(rawTop, geometry.clipTop, geometry.clipBottom)
  const right = clamp(rawRight, geometry.clipLeft, geometry.clipRight)
  const bottom = clamp(rawBottom, geometry.clipTop, geometry.clipBottom)
  const rawArea =
    Math.max(0, rawRight - rawLeft) * Math.max(0, rawBottom - rawTop)
  const visibleArea = Math.max(0, right - left) * Math.max(0, bottom - top)
  if (right <= left || bottom <= top) {
    return { rect: null, visibleRatio: 0 }
  }
  return {
    rect: [
      (left / canvasWidth) * 100,
      (top / canvasHeight) * 100,
      ((right - left) / canvasWidth) * 100,
      ((bottom - top) / canvasHeight) * 100
    ],
    visibleRatio: rawArea > 0 ? visibleArea / rawArea : 0
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
