import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import {
  calculateFrameGeometry,
  protectedRegionFocus,
  type FrameGeometry
} from './frame-geometry'
import {
  renderMeasuredText,
  type MeasuredTextFit,
  type MeasuredTextStyle
} from './measured-text'
import { resolveImpactFont } from './impact-font'
import { fixtureImagePath } from './fixtures'
import { renderMemeSourceFrame } from './render'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'
import type { SemanticMemeIntent } from './semantic-plan'
import { memeEvalCanvas } from './text-layout'

type PixelBounds = readonly [number, number, number, number]

export interface SafeMemeTextLayerCheck {
  readonly zone_id: string
  readonly font_family: string
  readonly display_transform: 'preserve' | 'uppercase'
  readonly wrap_mode: 'greedy' | 'balance'
  readonly font_size_px: number
  readonly preview_font_px: number
  readonly physical_lines: readonly string[]
  readonly ink_bounds_px: PixelBounds
  readonly fill_color?: string
  readonly stroke_color?: string | null
  readonly stroke_width_em: number
  readonly stroke_width_px: number
  readonly stroke_pixel_count: number
  readonly opaque_backplate?: boolean
  readonly legibility_pass?: boolean
}

export interface SafeMemeSourceFrameCheck {
  readonly image_id: string
  readonly frame_mode: MemeEvalPlan['presentation']['frame_mode']
  readonly target_bounds_px: PixelBounds
  readonly rendered_bounds_px: PixelBounds
}

export interface SafeMemeProtectedRegionCheck {
  readonly region_id: string
  readonly image_id: string
  readonly priority: 'must' | 'soft'
  readonly visible_ratio: number
  readonly canvas_bounds_px: PixelBounds | null
  readonly caption_overlap_px: number
}

export interface SafeMemeSourceOccupancyCheck {
  readonly minimum_preview_visible_height_px: number
  readonly minimum_canvas_height_ratio: number
  readonly required_canvas_height_ratio: number
  readonly meets_review_floor: true
}

export interface SafeMemeRenderComplete {
  readonly status: 'complete'
  readonly plan: MemeEvalPlan
  readonly checks: {
    readonly copy_preserved: true
    readonly glyph_overflow_px: 0
    readonly zones_inside_canvas: true
    readonly caption_area: 'overlay' | 'external'
    readonly minimum_canvas_clearance_px: number
    readonly minimum_preview_font_px: number
    readonly text_legibility_pass?: true
    readonly text_layers: readonly SafeMemeTextLayerCheck[]
    readonly source_frames: readonly SafeMemeSourceFrameCheck[]
    readonly protected_regions: readonly SafeMemeProtectedRegionCheck[]
    readonly source_occupancy?: SafeMemeSourceOccupancyCheck
  }
}

export interface SafeMemeRenderBlocked {
  readonly status: 'blocked'
  readonly reason: {
    readonly code:
      | 'missing_source'
      | 'missing_font'
      | 'unplaceable_text'
      | 'protected_region_conflict'
      | 'render_invariant_failed'
    readonly message: string
  }
}

export type SafeMemeRenderResult =
  | SafeMemeRenderComplete
  | SafeMemeRenderBlocked

interface ZoneBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface FittedZone {
  readonly sourceZone: MemeEvalPlan['presentation']['zones'][number]
  readonly box: ZoneBox
  readonly fit: MeasuredTextFit
}

interface FittedPlan {
  readonly zones: readonly FittedZone[]
  readonly captionArea: 'overlay' | 'external'
  readonly sourcePlacements: readonly SourcePlacement[]
  readonly protectedRegions: readonly SafeMemeProtectedRegionCheck[]
  readonly sourceOccupancy: SafeMemeSourceOccupancyCheck
}

interface SourcePlacement {
  readonly imageId: string
  readonly frameMode: MemeEvalPlan['presentation']['frame_mode']
  readonly target: ZoneBox
  readonly geometry: FrameGeometry
  readonly sourceWidth: number
  readonly sourceHeight: number
}

interface SourceDimensions {
  readonly width: number
  readonly height: number
}

interface FitBlocked {
  readonly status: 'blocked'
  readonly reason: SafeMemeRenderBlocked['reason']
}

interface TextTreatment {
  readonly backdrop: MemeEvalPlan['presentation']['zones'][number]['backdrop']
  readonly contrast: MemeEvalPlan['presentation']['zones'][number]['contrast']
}

interface RegionProjection {
  readonly bounds: PixelBounds | null
  readonly visibleRatio: number
}

type FitResult = ({ readonly status: 'fit' } & FittedPlan) | FitBlocked

const supportFontFilePath = fileURLToPath(
  new URL(
    '../../../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-ext-800-normal.woff',
    import.meta.url
  )
)

const impactFont = resolveImpactFont()

const codeFontFilePath = fileURLToPath(
  new URL(
    '../../../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2',
    import.meta.url
  )
)

const impactStyle: MeasuredTextStyle = {
  fill: '#ffffff',
  stroke: { color: '#000000', widthEm: 0.05 },
  wrap: 'balance',
  align: 'center',
  verticalAlign: 'center',
  lineHeight: 1.02,
  blockGapEm: 0.18,
  indentEm: 1.2
}

const codeStyle: MeasuredTextStyle = {
  ...impactStyle,
  wrap: 'greedy',
  align: 'left',
  lineHeight: 1.14,
  blockGapEm: 0.08
}

export async function renderSafeMemeIntent({
  fixture,
  intent,
  outputPath,
  previewPath
}: {
  readonly fixture: MemeSkillFixture
  readonly intent: SemanticMemeIntent
  readonly outputPath: string
  readonly previewPath?: string
}): Promise<SafeMemeRenderResult> {
  const knownImages = new Set(fixture.images.map(({ id }) => id))
  const missingImage = intent.presentation.source_frames.find(
    ({ image_id }) => !knownImages.has(image_id)
  )
  if (missingImage) {
    return {
      status: 'blocked',
      reason: {
        code: 'missing_source',
        message: `Unknown source image ${missingImage.image_id}`
      }
    }
  }

  return renderSafeMemePlan({
    fixture,
    plan: planFromSemanticIntent(fixture, intent),
    outputPath,
    previewPath
  })
}

export async function renderSafeMemePlan({
  fixture,
  plan,
  outputPath,
  previewPath
}: {
  readonly fixture: MemeSkillFixture
  readonly plan: MemeEvalPlan
  readonly outputPath: string
  readonly previewPath?: string
}): Promise<SafeMemeRenderResult> {
  const knownImages = new Set(fixture.images.map(({ id }) => id))
  const missingImage = plan.presentation.source_frames.find(
    ({ image_id }) => !knownImages.has(image_id)
  )
  if (missingImage) {
    return {
      status: 'blocked',
      reason: {
        code: 'missing_source',
        message: `Unknown source image ${missingImage.image_id}`
      }
    }
  }
  if (
    plan.presentation.zones.some(({ style }) => style === 'impact') &&
    impactFont.status !== 'resolved'
  ) {
    return {
      status: 'blocked',
      reason: {
        code: 'missing_font',
        message: impactFont.message
      }
    }
  }
  const invalidWhitespace = plan.caption_lines.find(
    ({ text }) => !hasCanonicalCaptionWhitespace(text)
  )
  if (invalidWhitespace) {
    return {
      status: 'blocked',
      reason: {
        code: 'unplaceable_text',
        message:
          'Caption beats must use single spaces; express code indentation with semantic indent levels'
      }
    }
  }

  let sourceDimensions: ReadonlyMap<string, SourceDimensions>
  try {
    sourceDimensions = await readSourceDimensions(fixture)
  } catch (err) {
    return {
      status: 'blocked',
      reason: {
        code: 'missing_source',
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }
  const fittedPlan = await fitPlan(plan, fixture, sourceDimensions)
  if (fittedPlan.status === 'blocked') {
    return fittedPlan
  }
  const fitted = fittedPlan.zones

  const realizedPlan = realizePlan(plan, fitted, fittedPlan.captionArea)
  const background = await renderSafeBackground(
    fixture,
    fittedPlan.sourcePlacements
  )
  const composites: {
    readonly input: Buffer
    readonly left: number
    readonly top: number
  }[] = []
  for (const zone of fitted) {
    const backdrop = await renderZoneBackdrop(zone)
    if (backdrop) {
      composites.push({
        input: backdrop,
        left: zone.box.left,
        top: zone.box.top
      })
    }
    composites.push({
      input: zone.fit.layerPng,
      left: zone.box.left,
      top: zone.box.top
    })
  }
  const raster = await sharp(background).composite(composites).png().toBuffer()
  const metadata = await sharp(raster).metadata()
  if (
    metadata.width !== memeEvalCanvas.width ||
    metadata.height !== memeEvalCanvas.height
  ) {
    return {
      status: 'blocked',
      reason: {
        code: 'render_invariant_failed',
        message: 'The encoded raster dimensions changed during composition'
      }
    }
  }

  const textLayers = await Promise.all(
    fitted.map(async (zone): Promise<SafeMemeTextLayerCheck> => {
      const bounds = globalInkBounds(zone)
      const style = textStyleFor(zone.sourceZone, fittedPlan.captionArea)
      const opaqueBackplate =
        fittedPlan.captionArea === 'external' ||
        zone.sourceZone.backdrop === 'solid-panel'
      const strokePixelCount = style.stroke
        ? await countOpaqueColorPixels(zone.fit.layerPng, style.stroke.color)
        : 0
      return {
        zone_id: zone.sourceZone.id,
        font_family: fontForStyle(zone.sourceZone.style).family,
        display_transform: displayTransformForStyle(zone.sourceZone.style),
        wrap_mode: style.wrap ?? 'greedy',
        font_size_px: zone.fit.fontSizePx,
        preview_font_px: (zone.fit.fontSizePx / memeEvalCanvas.width) * 480,
        physical_lines: zone.fit.physicalLines.map(({ text }) => text),
        ink_bounds_px: bounds,
        fill_color: style.fill,
        stroke_color: style.stroke?.color ?? null,
        stroke_width_em: style.stroke?.widthEm ?? 0,
        stroke_width_px: zone.fit.strokeWidthPx,
        stroke_pixel_count: strokePixelCount,
        opaque_backplate: opaqueBackplate,
        legibility_pass: Boolean(
          style.fill && (style.stroke ? strokePixelCount > 0 : opaqueBackplate)
        )
      }
    })
  )
  const copyPreserved = fitted.every(({ sourceZone, fit }) =>
    sourceZone.line_indexes.every(
      (lineIndex) =>
        fit.physicalLines
          .filter(({ blockId }) => blockId === `line-${lineIndex}`)
          .map(({ text }) => text)
          .join(' ') ===
        displayTextForStyle(
          plan.caption_lines[lineIndex]?.text ?? '',
          sourceZone.style
        )
    )
  )
  const glyphOverflowPx = Math.max(
    0,
    ...textLayers.map(({ ink_bounds_px }) =>
      overflowOutsideCanvas(ink_bounds_px)
    )
  )
  const zonesInsideCanvas = fitted.every(({ box }) => isInsideCanvas(box))
  const textLegibilityPass = textLayers.every(
    ({ legibility_pass }) => legibility_pass
  )
  if (
    !copyPreserved ||
    glyphOverflowPx > 0 ||
    !zonesInsideCanvas ||
    !textLegibilityPass
  ) {
    return {
      status: 'blocked',
      reason: {
        code: 'render_invariant_failed',
        message: 'Post-composition copy or canvas geometry verification failed'
      }
    }
  }

  await sharp(raster).toFile(outputPath)
  if (previewPath) {
    const preview = sharp(raster).resize({ width: 480 })
    if (extname(previewPath).toLowerCase() === '.webp') {
      await preview.webp({ quality: 84 }).toFile(previewPath)
    } else {
      await preview.png().toFile(previewPath)
    }
  }

  return {
    status: 'complete',
    plan: realizedPlan,
    checks: {
      copy_preserved: true,
      glyph_overflow_px: 0,
      zones_inside_canvas: true,
      caption_area: fittedPlan.captionArea,
      minimum_canvas_clearance_px: Math.min(
        ...textLayers.map(({ ink_bounds_px }) => canvasClearance(ink_bounds_px))
      ),
      minimum_preview_font_px: Math.min(
        ...textLayers.map(({ preview_font_px }) => preview_font_px)
      ),
      text_legibility_pass: true,
      text_layers: textLayers,
      source_frames: fittedPlan.sourcePlacements.map(sourceFrameCheck),
      protected_regions: fittedPlan.protectedRegions,
      source_occupancy: fittedPlan.sourceOccupancy
    }
  }
}

function planFromSemanticIntent(
  fixture: MemeSkillFixture,
  intent: SemanticMemeIntent
): MemeEvalPlan {
  const template = chooseTemplate(fixture, intent)
  const frameMode =
    fixture.expectations.allowed_frame_modes.length === 1
      ? fixture.expectations.allowed_frame_modes[0]!
      : (['extend', 'contain', 'cover'].find((mode) =>
          fixture.expectations.allowed_frame_modes.includes(
            mode as MemeEvalPlan['presentation']['frame_mode']
          )
        ) as MemeEvalPlan['presentation']['frame_mode'])
  const zoneGroups = semanticZoneGroups(intent, template)

  return {
    version: 1,
    fixture_id: intent.fixture_id,
    recognition_hinge: intent.recognition_hinge,
    ai_bridges: [intent.ai_bridge],
    caption_lines: intent.caption_lines.map(({ text, kind }) => ({
      text,
      kind
    })),
    format: intent.format,
    presentation: {
      template,
      frame_mode: frameMode,
      source_frames: intent.presentation.source_frames,
      zones: zoneGroups.map((group, index) => {
        const sourceLines = group.lineIndexes.map(
          (lineIndex) => intent.caption_lines[lineIndex]!
        )
        const palette = intent.presentation.palette
        const treatment = chooseTreatment(fixture, group.style, palette)
        return {
          id: group.id,
          line_indexes: group.lineIndexes,
          slot: resolveSemanticSlot(
            fixture,
            template,
            group.lineIndexes,
            group.slot
          ),
          bounds_pct: [4, index === 0 ? 4 : 70, 92, 26],
          font_size_pct: group.style === 'code' ? 3.5 : 5,
          rendered_line_count: sourceLines.length,
          style: group.style,
          backdrop: treatment.backdrop,
          contrast: treatment.contrast,
          palette,
          anchor_region_id:
            fixture.expectations.required_zone_anchors?.[
              group.lineIndexes[0]!
            ] ??
            sourceLines.find(({ anchor_region_id }) => anchor_region_id)
              ?.anchor_region_id ??
            null,
          indent_levels: sourceLines.map(({ indent_level }) => indent_level)
        }
      })
    },
    why_it_works: intent.why_it_works
  }
}

function chooseTemplate(
  fixture: MemeSkillFixture,
  intent: SemanticMemeIntent
): MemeEvalPlan['presentation']['template'] {
  const allowed = fixture.expectations.allowed_templates
  if (allowed.length === 1) return allowed[0]!
  const preferred =
    intent.presentation.mode === 'state-contrast'
      ? 'diptych'
      : intent.presentation.mode === 'dialogue'
        ? 'dialogue'
        : intent.presentation.mode === 'source-native'
          ? 'interface'
          : 'overlay'
  return allowed.includes(preferred) ? preferred : allowed[0]!
}

function chooseTreatment(
  fixture: MemeSkillFixture,
  style: MemeEvalPlan['presentation']['zones'][number]['style'],
  palette: MemeEvalPlan['presentation']['zones'][number]['palette']
): TextTreatment {
  const lockedBackdrop =
    fixture.expectations.allowed_backdrops?.length === 1
      ? fixture.expectations.allowed_backdrops[0]
      : undefined
  const lockedContrast =
    fixture.expectations.allowed_contrast?.length === 1
      ? fixture.expectations.allowed_contrast[0]
      : undefined
  if (lockedBackdrop || lockedContrast) {
    const backdrop = lockedBackdrop ?? contrastToBackdrop(lockedContrast!)
    const contrast = lockedContrast ?? backdropToContrast(backdrop)
    return { backdrop, contrast }
  }
  if (
    palette === 'orange-white' ||
    style === 'code' ||
    style === 'status' ||
    style === 'label'
  ) {
    return { backdrop: 'solid-panel', contrast: 'solid-panel' }
  }
  return { backdrop: 'none', contrast: 'outlined' }
}

function resolveSemanticSlot(
  fixture: MemeSkillFixture,
  template: MemeEvalPlan['presentation']['template'],
  lineIndexes: readonly number[],
  fallback: MemeEvalPlan['presentation']['zones'][number]['slot']
): MemeEvalPlan['presentation']['zones'][number]['slot'] {
  if (template === 'band-top') return 'top'
  if (template === 'band-bottom' || template === 'interface') return 'bottom'
  const locks = lineIndexes
    .map((lineIndex) => fixture.expectations.required_line_slots?.[lineIndex])
    .filter((slots): slots is NonNullable<typeof slots> => Boolean(slots))
  if (!locks.length) return fallback
  const common = locks.reduce<
    readonly MemeEvalPlan['presentation']['zones'][number]['slot'][]
  >(
    (values, slots) => values.filter((value) => slots.includes(value)),
    locks[0]!
  )
  return common.includes(fallback) ? fallback : (common[0] ?? fallback)
}

function contrastToBackdrop(
  contrast: MemeEvalPlan['presentation']['zones'][number]['contrast']
): MemeEvalPlan['presentation']['zones'][number]['backdrop'] {
  return contrast === 'outlined' ? 'none' : contrast
}

function backdropToContrast(
  backdrop: MemeEvalPlan['presentation']['zones'][number]['backdrop']
): MemeEvalPlan['presentation']['zones'][number]['contrast'] {
  return backdrop === 'none' ? 'outlined' : backdrop
}

function semanticZoneGroups(
  intent: SemanticMemeIntent,
  template: MemeEvalPlan['presentation']['template']
): readonly {
  readonly id: string
  readonly lineIndexes: number[]
  readonly slot: MemeEvalPlan['presentation']['zones'][number]['slot']
  readonly style: MemeEvalPlan['presentation']['zones'][number]['style']
}[] {
  const indexes = intent.caption_lines.map((_, index) => index)
  const styleFor = (lineIndex: number) => {
    const role = intent.caption_lines[lineIndex]!.role
    if (role === 'code') return 'code' as const
    if (role === 'status') return 'status' as const
    if (role === 'label') return 'label' as const
    if (role === 'speech') return 'dialogue' as const
    return 'impact' as const
  }
  if (
    template === 'band-top' ||
    template === 'band-bottom' ||
    template === 'interface' ||
    intent.presentation.mode === 'source-native' ||
    intent.presentation.mode === 'single'
  ) {
    return [
      {
        id: 'caption',
        lineIndexes: indexes,
        slot:
          template === 'band-top' ||
          intent.presentation.preferred_edge === 'top'
            ? ('top' as const)
            : ('bottom' as const),
        style: indexes.some((index) => styleFor(index) === 'code')
          ? ('code' as const)
          : styleFor(0)
      }
    ]
  }
  if (intent.presentation.mode === 'state-contrast') {
    return indexes.map((lineIndex, index) => ({
      id: index === 0 ? 'before' : 'after',
      lineIndexes: [lineIndex],
      slot: index === 0 ? ('panel-left' as const) : ('panel-right' as const),
      style: styleFor(lineIndex)
    }))
  }
  if (intent.presentation.mode === 'dialogue') {
    return indexes.map((lineIndex, index) => ({
      id: `speaker-${index + 1}`,
      lineIndexes: [lineIndex],
      slot: index % 2 === 0 ? ('top-left' as const) : ('bottom-right' as const),
      style: styleFor(lineIndex)
    }))
  }

  const payoffIndexes = indexes.filter(
    (index) => intent.caption_lines[index]!.role === 'payoff'
  )
  const setupIndexes = indexes.filter((index) => !payoffIndexes.includes(index))
  return [
    {
      id: 'setup',
      lineIndexes: setupIndexes.length ? setupIndexes : [indexes[0]!],
      slot: 'top' as const,
      style: styleFor(setupIndexes[0] ?? indexes[0]!)
    },
    {
      id: 'payoff',
      lineIndexes: payoffIndexes.length
        ? payoffIndexes
        : [indexes[indexes.length - 1]!],
      slot: 'bottom' as const,
      style: styleFor(payoffIndexes[0] ?? indexes[indexes.length - 1]!)
    }
  ].filter(
    (group, index, groups) =>
      index === 0 ||
      group.lineIndexes.some(
        (lineIndex) => !groups[0]!.lineIndexes.includes(lineIndex)
      )
  )
}

async function fitPlan(
  plan: MemeEvalPlan,
  fixture: MemeSkillFixture,
  sourceDimensions: ReadonlyMap<string, SourceDimensions>
): Promise<FitResult> {
  const templateOwnsCaptionArea = [
    'band-top',
    'band-bottom',
    'sidecar-left',
    'sidecar-right',
    'diptych'
  ].includes(plan.presentation.template)
  let fittedAnyText = false
  let rejectedForProtectedRegion = false
  for (const boxes of candidateBoxSets(plan)) {
    const captionArea = templateOwnsCaptionArea ? 'external' : 'overlay'
    const balanced = await fitBoxes(
      plan,
      boxes,
      fixture.expectations.maximum_rendered_lines_per_zone,
      captionArea
    )
    if (!balanced) continue
    fittedAnyText = true
    const assessed = assessCandidate({
      fixture,
      plan,
      zones: balanced,
      captionArea,
      sourceDimensions
    })
    if (assessed) return { status: 'fit', ...assessed }
    rejectedForProtectedRegion = true
  }

  if (fittedAnyText && !templateOwnsCaptionArea) {
    for (const boxSets of externalCandidateBoxSetPhases(plan)) {
      let bestExternal: FittedPlan | undefined
      for (const boxes of boxSets) {
        const balanced = await fitBoxes(
          plan,
          boxes,
          fixture.expectations.maximum_rendered_lines_per_zone,
          'external'
        )
        if (!balanced) continue
        const assessed = assessCandidate({
          fixture,
          plan,
          zones: balanced,
          captionArea: 'external',
          sourceDimensions
        })
        if (!assessed) {
          rejectedForProtectedRegion = true
          continue
        }
        if (plan.presentation.zones.length !== 1) {
          return { status: 'fit', ...assessed }
        }
        if (
          !bestExternal ||
          minimumFittedFontSize(assessed) > minimumFittedFontSize(bestExternal)
        ) {
          bestExternal = assessed
        }
        if (
          bestExternal &&
          minimumFittedFontSize(bestExternal) >= comfortableExternalFontSizePx
        ) {
          break
        }
      }
      if (bestExternal) return { status: 'fit', ...bestExternal }
    }
  }
  return {
    status: 'blocked',
    reason: rejectedForProtectedRegion
      ? {
          code: 'protected_region_conflict',
          message:
            'No supported layout keeps every must-preserve source region visible and unobscured'
        }
      : {
          code: 'unplaceable_text',
          message:
            'The exact caption does not fit any supported layout above the readability floor'
        }
  }
}

const comfortableExternalFontSizePx = 55

function minimumFittedFontSize(plan: FittedPlan): number {
  return Math.min(...plan.zones.map(({ fit }) => fit.fontSizePx))
}

function externalCandidateBoxSetPhases(
  plan: MemeEvalPlan
): readonly (readonly (readonly ZoneBox[])[])[] {
  const candidates = externalCandidateBoxSets(plan)
  return plan.presentation.zones.length === 1
    ? [candidates.slice(0, 3), candidates.slice(3)]
    : [candidates]
}

function assessCandidate({
  fixture,
  plan,
  zones,
  captionArea,
  sourceDimensions
}: {
  readonly fixture: MemeSkillFixture
  readonly plan: MemeEvalPlan
  readonly zones: readonly FittedZone[]
  readonly captionArea: 'overlay' | 'external'
  readonly sourceDimensions: ReadonlyMap<string, SourceDimensions>
}): FittedPlan | null {
  const sourcePlacements = sourcePlacementsFor({
    fixture,
    plan,
    zones,
    captionArea,
    sourceDimensions
  })
  if (!sourcePlacements) return null
  const sourceOccupancy = measureSourceOccupancy({
    plan,
    zones,
    captionArea,
    sourcePlacements
  })
  if (!sourceOccupancy) return null
  const protectedRegions = projectProtectedRegions(
    fixture,
    sourcePlacements,
    zones
  )
  const invalidMustRegion = protectedRegions.some(
    ({ priority, visible_ratio, caption_overlap_px }) =>
      priority === 'must' && (visible_ratio < 0.995 || caption_overlap_px > 0)
  )
  return invalidMustRegion
    ? null
    : {
        zones,
        captionArea,
        sourcePlacements,
        protectedRegions,
        sourceOccupancy
      }
}

function measureSourceOccupancy({
  plan,
  zones,
  captionArea,
  sourcePlacements
}: {
  readonly plan: MemeEvalPlan
  readonly zones: readonly FittedZone[]
  readonly captionArea: 'overlay' | 'external'
  readonly sourcePlacements: readonly SourcePlacement[]
}): SafeMemeSourceOccupancyCheck | null {
  const minimumVisibleHeight = Math.min(
    ...sourcePlacements.map(({ geometry }) =>
      Math.max(
        0,
        Math.min(
          geometry.imageTop + geometry.renderedHeight,
          geometry.clipBottom
        ) - Math.max(geometry.imageTop, geometry.clipTop)
      )
    )
  )
  const minimumCanvasHeightRatio = minimumVisibleHeight / memeEvalCanvas.height
  const templateOwnsCaptionArea = [
    'band-top',
    'band-bottom',
    'sidecar-left',
    'sidecar-right',
    'diptych'
  ].includes(plan.presentation.template)
  const requiredCanvasHeightRatio =
    captionArea === 'external' && !templateOwnsCaptionArea
      ? zones.length === 1
        ? zones[0]!.fit.physicalLines.length >= 3
          ? 0.65
          : 0.75
        : zones.length === 2
          ? 0.6
          : 0
      : 0
  if (minimumCanvasHeightRatio + Number.EPSILON < requiredCanvasHeightRatio) {
    return null
  }
  return {
    minimum_preview_visible_height_px:
      minimumVisibleHeight * (480 / memeEvalCanvas.width),
    minimum_canvas_height_ratio: minimumCanvasHeightRatio,
    required_canvas_height_ratio: requiredCanvasHeightRatio,
    meets_review_floor: true
  }
}

function sourcePlacementsFor({
  fixture,
  plan,
  zones,
  captionArea,
  sourceDimensions
}: {
  readonly fixture: MemeSkillFixture
  readonly plan: MemeEvalPlan
  readonly zones: readonly FittedZone[]
  readonly captionArea: 'overlay' | 'external'
  readonly sourceDimensions: ReadonlyMap<string, SourceDimensions>
}): readonly SourcePlacement[] | null {
  const frames = plan.presentation.source_frames
  let targets: readonly ZoneBox[]

  if (plan.presentation.template === 'diptych') {
    if (frames.length !== 2 || zones.length !== 2) return null
    const imageBottom = Math.min(...zones.map(({ box }) => box.top))
    if (imageBottom <= 0) return null
    targets = [
      { left: 0, top: 0, width: 600, height: imageBottom },
      { left: 600, top: 0, width: 600, height: imageBottom }
    ]
  } else {
    if (frames.length !== 1) return null
    if (plan.presentation.template === 'sidecar-left') {
      targets = [{ left: 330, top: 0, width: 870, height: 800 }]
    } else if (plan.presentation.template === 'sidecar-right') {
      targets = [{ left: 0, top: 0, width: 870, height: 800 }]
    } else if (captionArea === 'external') {
      const topBoxes = zones
        .map(({ box }) => box)
        .filter(
          ({ top, height }) => top + height / 2 < memeEvalCanvas.height / 2
        )
      const bottomBoxes = zones
        .map(({ box }) => box)
        .filter(
          ({ top, height }) => top + height / 2 >= memeEvalCanvas.height / 2
        )
      const imageTop = topBoxes.length
        ? Math.max(...topBoxes.map(({ top, height }) => top + height))
        : 0
      const imageBottom = bottomBoxes.length
        ? Math.min(...bottomBoxes.map(({ top }) => top))
        : memeEvalCanvas.height
      if (imageBottom <= imageTop) return null
      targets = [
        {
          left: 0,
          top: imageTop,
          width: memeEvalCanvas.width,
          height: imageBottom - imageTop
        }
      ]
    } else {
      targets = [
        {
          left: 0,
          top: 0,
          width: memeEvalCanvas.width,
          height: memeEvalCanvas.height
        }
      ]
    }
  }

  const placements: SourcePlacement[] = []
  for (const [index, frame] of frames.entries()) {
    const target = targets[index]!
    const dimensions = sourceDimensions.get(frame.image_id)
    if (!target || !dimensions) return null
    const focus = protectedRegionFocus(
      fixture.protected_regions.filter(
        ({ image_id }) => image_id === frame.image_id
      )
    )
    const geometry = calculateFrameGeometry({
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      targetLeft: target.left,
      targetTop: target.top,
      targetWidth: target.width,
      targetHeight: target.height,
      frameMode:
        plan.presentation.frame_mode === 'extend'
          ? 'contain'
          : plan.presentation.frame_mode,
      focus
    })
    placements.push({
      imageId: frame.image_id,
      frameMode: plan.presentation.frame_mode,
      target,
      geometry,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height
    })
  }
  return placements
}

function projectProtectedRegions(
  fixture: MemeSkillFixture,
  placements: readonly SourcePlacement[],
  zones: readonly FittedZone[]
): readonly SafeMemeProtectedRegionCheck[] {
  const captionBounds = zones.map(paintedCaptionBounds)
  return fixture.protected_regions.map((region) => {
    const placement = placements.find(
      ({ imageId }) => imageId === region.image_id
    )
    if (!placement) {
      return {
        region_id: region.id,
        image_id: region.image_id,
        priority: region.priority,
        visible_ratio: 0,
        canvas_bounds_px: null,
        caption_overlap_px: 0
      }
    }
    const projection = projectRegion(region.canvas_rect_pct, placement)
    return {
      region_id: region.id,
      image_id: region.image_id,
      priority: region.priority,
      visible_ratio: projection.visibleRatio,
      canvas_bounds_px: projection.bounds,
      caption_overlap_px: projection.bounds
        ? captionBounds.reduce(
            (area, bounds) =>
              area + rectangleIntersectionArea(projection.bounds!, bounds),
            0
          )
        : 0
    }
  })
}

function projectRegion(
  [x, y, width, height]: PixelBounds,
  placement: SourcePlacement
): RegionProjection {
  const geometry = placement.geometry
  const rawLeft =
    geometry.imageLeft + (x / 100) * placement.sourceWidth * geometry.scale
  const rawTop =
    geometry.imageTop + (y / 100) * placement.sourceHeight * geometry.scale
  const rawRight =
    rawLeft + (width / 100) * placement.sourceWidth * geometry.scale
  const rawBottom =
    rawTop + (height / 100) * placement.sourceHeight * geometry.scale
  const left = clamp(rawLeft, geometry.clipLeft, geometry.clipRight)
  const top = clamp(rawTop, geometry.clipTop, geometry.clipBottom)
  const right = clamp(rawRight, geometry.clipLeft, geometry.clipRight)
  const bottom = clamp(rawBottom, geometry.clipTop, geometry.clipBottom)
  const rawArea =
    Math.max(0, rawRight - rawLeft) * Math.max(0, rawBottom - rawTop)
  const visibleArea = Math.max(0, right - left) * Math.max(0, bottom - top)
  return {
    bounds:
      right > left && bottom > top
        ? [left, top, right - left, bottom - top]
        : null,
    visibleRatio: rawArea > 0 ? visibleArea / rawArea : 0
  }
}

function paintedCaptionBounds(zone: FittedZone): PixelBounds {
  return usesPaintedBackdrop(zone.sourceZone)
    ? [zone.box.left, zone.box.top, zone.box.width, zone.box.height]
    : globalInkBounds(zone)
}

function rectangleIntersectionArea(
  left: PixelBounds,
  right: PixelBounds
): number {
  const intersectionWidth = Math.max(
    0,
    Math.min(left[0] + left[2], right[0] + right[2]) -
      Math.max(left[0], right[0])
  )
  const intersectionHeight = Math.max(
    0,
    Math.min(left[1] + left[3], right[1] + right[3]) -
      Math.max(left[1], right[1])
  )
  return intersectionWidth * intersectionHeight
}

async function fitBoxes(
  plan: MemeEvalPlan,
  boxes: readonly ZoneBox[],
  maximumPhysicalLines: number | undefined,
  captionArea: 'overlay' | 'external'
): Promise<readonly FittedZone[] | null> {
  if (boxes.length !== plan.presentation.zones.length) return null
  const initial = await Promise.all(
    plan.presentation.zones.map((zone, index) =>
      fitZone(
        plan,
        zone,
        boxes[index]!,
        undefined,
        maximumPhysicalLines,
        captionArea
      )
    )
  )
  if (initial.some((fit) => fit === null)) return null
  const fits = initial as FittedZone[]
  const sharedFontSize = Math.min(...fits.map(({ fit }) => fit.fontSizePx))
  const balanced = await Promise.all(
    fits.map(({ sourceZone, box }) =>
      fitZone(
        plan,
        sourceZone,
        box,
        sharedFontSize,
        maximumPhysicalLines,
        captionArea
      )
    )
  )
  return balanced.every((fit) => fit !== null)
    ? (balanced as FittedZone[])
    : null
}

async function fitZone(
  plan: MemeEvalPlan,
  zone: MemeEvalPlan['presentation']['zones'][number],
  box: ZoneBox,
  fixedFontSize?: number,
  maximumPhysicalLines?: number,
  captionArea: 'overlay' | 'external' = 'overlay'
): Promise<FittedZone | null> {
  const style = textStyleFor(zone, captionArea)
  const minimumFontSize = minimumFontSizePx(zone.style)
  const maximumFontSize = maximumFontSizePx(zone.style)
  const blocks = zone.line_indexes.map((lineIndex, index) => ({
    id: `line-${lineIndex}`,
    text: displayTextForStyle(
      plan.caption_lines[lineIndex]?.text ?? '',
      zone.style
    ),
    indentLevel: clampIndent(zone.indent_levels[index] ?? 0)
  }))
  if (!blocks.length || blocks.some(({ text }) => !text)) return null
  const result = await renderMeasuredText({
    blocks: blocks as [
      {
        readonly id: string
        readonly text: string
        readonly indentLevel: 0 | 1 | 2 | 3 | 4
      },
      ...{
        readonly id: string
        readonly text: string
        readonly indentLevel: 0 | 1 | 2 | 3 | 4
      }[]
    ],
    font: fontForStyle(zone.style),
    style,
    maxWidthPx: box.width,
    maxHeightPx: box.height,
    minimumFontSizePx: fixedFontSize ?? minimumFontSize,
    maximumFontSizePx: fixedFontSize ?? maximumFontSize,
    maximumPhysicalLines,
    safeInsetPx:
      zone.style === 'code' || zone.style === 'status' || zone.style === 'label'
        ? 8
        : 12
  })
  return result.status === 'fit' ? { sourceZone: zone, box, fit: result } : null
}

function textStyleFor(
  zone: MemeEvalPlan['presentation']['zones'][number],
  captionArea: 'overlay' | 'external'
): MeasuredTextStyle {
  const base = zone.style === 'code' ? codeStyle : impactStyle
  if (zone.style === 'impact') return base
  if (zone.backdrop !== 'solid-panel' && captionArea !== 'external') return base
  const { stroke: _stroke, ...withoutStroke } = base
  return withoutStroke
}

function displayTransformForStyle(
  style: MemeEvalPlan['presentation']['zones'][number]['style']
): 'preserve' | 'uppercase' {
  return style === 'impact' ? 'uppercase' : 'preserve'
}

function displayTextForStyle(
  text: string,
  style: MemeEvalPlan['presentation']['zones'][number]['style']
): string {
  return displayTransformForStyle(style) === 'uppercase'
    ? text.toLocaleUpperCase('en-US')
    : text
}

function fontForStyle(
  style: MemeEvalPlan['presentation']['zones'][number]['style']
) {
  if (style === 'impact') {
    if (impactFont.status !== 'resolved') {
      throw new Error('Impact font preflight was skipped')
    }
    return {
      family: impactFont.family,
      filePath: impactFont.filePath,
      weight: 400
    }
  }
  if (style === 'code') {
    return { family: 'Geist Mono', filePath: codeFontFilePath, weight: 700 }
  }
  return {
    family: 'Barlow Condensed',
    filePath: supportFontFilePath,
    weight: 800
  }
}

async function countOpaqueColorPixels(
  buffer: Buffer,
  color: string
): Promise<number> {
  const [red, green, blue] = color
    .slice(1)
    .match(/.{2}/gu)!
    .map((channel) => Number.parseInt(channel, 16))
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let count = 0
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (
      data[offset] === red &&
      data[offset + 1] === green &&
      data[offset + 2] === blue &&
      data[offset + 3] === 255
    ) {
      count += 1
    }
  }
  return count
}

function candidateBoxSets(plan: MemeEvalPlan): readonly (readonly ZoneBox[])[] {
  const zones = plan.presentation.zones
  const { template } = plan.presentation
  if (template === 'interface' && zones.length === 1) {
    const semanticLineCount = zones[0]!.line_indexes.length
    const bandHeight = Math.min(
      300,
      Math.max(190, 130 + semanticLineCount * 32)
    )
    const tightHeight = Math.min(
      290,
      Math.max(155, 65 + semanticLineCount * 45)
    )
    return [
      [
        {
          left: 24,
          top: memeEvalCanvas.height - bandHeight + 12,
          width: 1152,
          height: bandHeight - 24
        }
      ],
      [
        {
          left: 24,
          top: memeEvalCanvas.height - tightHeight,
          width: 1152,
          height: tightHeight
        }
      ]
    ]
  }
  if (template === 'band-top') {
    return [[{ left: 24, top: 12, width: 1152, height: 248 }]]
  }
  if (template === 'band-bottom') {
    return [[{ left: 24, top: 540, width: 1152, height: 248 }]]
  }
  if (template === 'sidecar-left' || template === 'sidecar-right') {
    const left = template === 'sidecar-left' ? 12 : 882
    const gap = 12
    const height = Math.floor((752 - gap * (zones.length - 1)) / zones.length)
    return [
      zones.map((_, index) => ({
        left,
        top: 24 + index * (height + gap),
        width: 306,
        height
      }))
    ]
  }
  if (template === 'diptych' && zones.length === 2) {
    return [
      [
        { left: 18, top: 492, width: 564, height: 290 },
        { left: 618, top: 492, width: 564, height: 290 }
      ]
    ]
  }
  if (template === 'dialogue' && zones.length === 2) {
    return [zones.map(({ slot }) => dialogueBox(slot))]
  }
  if (zones.length === 1) {
    const tall = template === 'interface' || zones[0]!.style === 'code'
    const height = tall ? 380 : 240
    const top = { left: 30, top: 18, width: 1140, height }
    const bottom = {
      left: 30,
      top: memeEvalCanvas.height - height - 18,
      width: 1140,
      height
    }
    return zones[0]!.slot.startsWith('top')
      ? [[top], [bottom]]
      : [[bottom], [top]]
  }
  if (zones.length === 2) {
    const top = { left: 30, top: 12, width: 1140, height: 180 }
    const bottom = { left: 30, top: 608, width: 1140, height: 180 }
    const compactTop = { left: 30, top: 12, width: 1140, height: 140 }
    const compactBottom = { left: 30, top: 648, width: 1140, height: 140 }
    const place = (zone: (typeof zones)[number], compact: boolean) => {
      const useTop = zone.slot.startsWith('top')
      if (compact) return useTop ? compactTop : compactBottom
      return useTop ? top : bottom
    }
    return [
      zones.map((zone) => place(zone, false)),
      zones.map((zone) => place(zone, true))
    ]
  }

  const gap = 10
  const height = Math.floor(
    (memeEvalCanvas.height - 36 - gap * (zones.length - 1)) / zones.length
  )
  return [
    zones.map((_, index) => ({
      left: 30,
      top: 18 + index * (height + gap),
      width: 1140,
      height
    }))
  ]
}

function dialogueBox(
  slot: MemeEvalPlan['presentation']['zones'][number]['slot']
): ZoneBox {
  const left = slot.endsWith('right') || slot === 'panel-right' ? 630 : 30
  const top = slot.startsWith('top') ? 18 : 582
  return { left, top, width: 540, height: 200 }
}

function externalCandidateBoxSets(
  plan: MemeEvalPlan
): readonly (readonly ZoneBox[])[] {
  const zones = plan.presentation.zones
  if (zones.length === 1) {
    const bottom = [{ left: 24, top: 552, width: 1152, height: 236 }]
    const top = [{ left: 24, top: 12, width: 1152, height: 236 }]
    const compactBottom = [{ left: 24, top: 675, width: 1152, height: 125 }]
    const compactTop = [{ left: 24, top: 0, width: 1152, height: 125 }]
    const reviewBottom = [{ left: 24, top: 620, width: 1152, height: 180 }]
    const reviewTop = [{ left: 24, top: 0, width: 1152, height: 180 }]
    return zones[0]!.slot.startsWith('top')
      ? [compactTop, reviewTop, top, compactBottom, reviewBottom, bottom]
      : [compactBottom, reviewBottom, bottom, compactTop, reviewTop, top]
  }
  if (zones.length === 2) {
    const place = (topHeight: number, bottomHeight: number, edgeInset = 0) =>
      zones.map((zone, index) => {
        const topSlot = zone.slot.startsWith('top')
          ? true
          : zone.slot.startsWith('bottom')
            ? false
            : index === 0
        const height = topSlot ? topHeight : bottomHeight
        return {
          left: 30,
          top: topSlot ? edgeInset : memeEvalCanvas.height - edgeInset - height,
          width: 1140,
          height
        }
      })
    return [
      place(140, 140, 12),
      place(140, 180),
      place(180, 140),
      place(160, 160),
      [
        { left: 24, top: 12, width: 1152, height: 220 },
        { left: 24, top: 568, width: 1152, height: 220 }
      ]
    ]
  }
  return []
}

async function renderSafeBackground(
  fixture: MemeSkillFixture,
  placements: readonly SourcePlacement[]
): Promise<Buffer> {
  const frames = await Promise.all(
    placements.map(async ({ imageId, frameMode, target }) => ({
      input: await renderMemeSourceFrame({
        fixture,
        imageId,
        width: target.width,
        height: target.height,
        frameMode
      }),
      left: target.left,
      top: target.top
    }))
  )
  return sharp({
    create: {
      ...memeEvalCanvas,
      channels: 4,
      background: '#020617'
    }
  })
    .composite(frames)
    .png()
    .toBuffer()
}

function realizePlan(
  plan: MemeEvalPlan,
  fitted: readonly FittedZone[],
  captionArea: 'overlay' | 'external'
): MemeEvalPlan {
  return {
    ...plan,
    presentation: {
      ...plan.presentation,
      zones: fitted.map(({ sourceZone, fit, box }) => {
        const externalPanel =
          captionArea === 'external' && sourceZone.backdrop === 'none'
        const backdrop = externalPanel ? 'solid-panel' : sourceZone.backdrop
        const contrast = externalPanel ? 'solid-panel' : sourceZone.contrast
        return {
          ...sourceZone,
          bounds_pct: [
            (box.left / memeEvalCanvas.width) * 100,
            (box.top / memeEvalCanvas.height) * 100,
            (box.width / memeEvalCanvas.width) * 100,
            (box.height / memeEvalCanvas.height) * 100
          ],
          font_size_pct: (fit.fontSizePx / memeEvalCanvas.width) * 100,
          rendered_line_count: fit.physicalLines.length,
          backdrop,
          contrast
        }
      })
    }
  }
}

async function renderZoneBackdrop(zone: FittedZone): Promise<Buffer | null> {
  if (!usesPaintedBackdrop(zone.sourceZone)) {
    return null
  }
  if (zone.sourceZone.backdrop === 'edge-gradient') {
    const topEdge = zone.sourceZone.slot.startsWith('top')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${zone.box.width}" height="${zone.box.height}"><defs><linearGradient id="edge" x1="0" y1="${topEdge ? 0 : 1}" x2="0" y2="${topEdge ? 1 : 0}"><stop offset="0" stop-color="#020617" stop-opacity=".82"/><stop offset="1" stop-color="#020617" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#edge)"/></svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
  }
  const fill =
    zone.sourceZone.palette === 'orange-white' ? '#d96b18' : '#020617'
  const inset = 4
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${zone.box.width}" height="${zone.box.height}"><rect x="${inset}" y="${inset}" width="${zone.box.width - inset * 2}" height="${zone.box.height - inset * 2}" rx="14" fill="${fill}"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

function usesPaintedBackdrop(
  zone: MemeEvalPlan['presentation']['zones'][number]
): boolean {
  return zone.backdrop === 'solid-panel' || zone.backdrop === 'edge-gradient'
}

function globalInkBounds(zone: FittedZone): PixelBounds {
  return [
    zone.box.left + zone.fit.inkBoundsPx.left,
    zone.box.top + zone.fit.inkBoundsPx.top,
    zone.fit.inkBoundsPx.width,
    zone.fit.inkBoundsPx.height
  ]
}

function canvasClearance([left, top, width, height]: PixelBounds): number {
  return Math.min(
    left,
    top,
    memeEvalCanvas.width - (left + width),
    memeEvalCanvas.height - (top + height)
  )
}

function minimumFontSizePx(
  style: MemeEvalPlan['presentation']['zones'][number]['style']
): number {
  if (style === 'code' || style === 'status') return 45
  if (style === 'dialogue' || style === 'label') return 46
  return 45
}

function maximumFontSizePx(
  style: MemeEvalPlan['presentation']['zones'][number]['style']
): number {
  if (style === 'code' || style === 'status') return 58
  if (style === 'dialogue' || style === 'label') return 70
  return 84
}

function clampIndent(value: number): 0 | 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(0, value)) as 0 | 1 | 2 | 3 | 4
}

async function readSourceDimensions(
  fixture: MemeSkillFixture
): Promise<ReadonlyMap<string, SourceDimensions>> {
  return new Map(
    await Promise.all(
      fixture.images.map(async ({ id }) => {
        const metadata = await sharp(fixtureImagePath(fixture, id)).metadata()
        if (!metadata.width || !metadata.height) {
          throw new Error(`Could not read source dimensions for ${id}`)
        }
        return [id, { width: metadata.width, height: metadata.height }] as const
      })
    )
  )
}

function hasCanonicalCaptionWhitespace(value: string): boolean {
  return value === value.trim() && !/[\t\r\n\v\f]| {2}/u.test(value)
}

function overflowOutsideCanvas([
  left,
  top,
  width,
  height
]: PixelBounds): number {
  return Math.max(
    0,
    -left,
    -top,
    left + width - memeEvalCanvas.width,
    top + height - memeEvalCanvas.height
  )
}

function isInsideCanvas({ left, top, width, height }: ZoneBox): boolean {
  return (
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= memeEvalCanvas.width &&
    top + height <= memeEvalCanvas.height
  )
}

function sourceFrameCheck(
  placement: SourcePlacement
): SafeMemeSourceFrameCheck {
  return {
    image_id: placement.imageId,
    frame_mode: placement.frameMode,
    target_bounds_px: [
      placement.target.left,
      placement.target.top,
      placement.target.width,
      placement.target.height
    ],
    rendered_bounds_px: [
      placement.geometry.imageLeft,
      placement.geometry.imageTop,
      placement.geometry.renderedWidth,
      placement.geometry.renderedHeight
    ]
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
