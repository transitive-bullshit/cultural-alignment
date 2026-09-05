import { stripTerminalMemePeriod } from '../../../../scripts/meme-review-round-utils'
import {
  memeEvalPlanSchema,
  type MemeEvalPlan,
  type MemeSkillFixture
} from './schema'
import { layoutMemeTextZone, memeEvalCanvas } from './text-layout'

export type MemeEvalViolationCode =
  | 'caption.exact-copy'
  | 'caption.forbidden-term'
  | 'caption.line-count'
  | 'caption.line-kind'
  | 'caption.required-term'
  | 'caption.terminal-period'
  | 'caption.word-count'
  | 'concept.expected'
  | 'concept.single'
  | 'fixture.id'
  | 'format.expected'
  | 'format.state-contrast'
  | 'frame.distinct'
  | 'frame.expected'
  | 'frame.known-image'
  | 'frame.protected-visible'
  | 'frame.template-count'
  | 'hinge.acknowledged'
  | 'layout.anchor'
  | 'layout.backdrop'
  | 'layout.contrast'
  | 'layout.line-coverage'
  | 'layout.palette'
  | 'layout.protected-region'
  | 'layout.semantic-zones'
  | 'layout.slot'
  | 'layout.slot-geometry'
  | 'layout.zone-overlap'
  | 'layout.zone-width'
  | 'layout.zones'
  | 'presentation.frame-mode'
  | 'presentation.template'
  | 'revision.rejected-caption'
  | 'revision.rejected-format'
  | 'schema.output'
  | 'typography.impossible-wrap'
  | 'typography.indentation'
  | 'typography.rendered-lines'
  | 'typography.size'
  | 'typography.vertical-fit'

export interface MemeEvalViolation {
  readonly code: MemeEvalViolationCode
  readonly message: string
}

export interface MemeEvalResult {
  readonly pass: boolean
  readonly violations: readonly MemeEvalViolation[]
  readonly plan: MemeEvalPlan | null
}

type PercentageRect = readonly [number, number, number, number]

export function evaluateMemePlan(
  fixture: MemeSkillFixture,
  input: unknown
): MemeEvalResult {
  const parsed = memeEvalPlanSchema.safeParse(input)

  if (!parsed.success) {
    return {
      pass: false,
      violations: [
        {
          code: 'schema.output',
          message: zodIssueSummary(parsed.error.issues)
        }
      ],
      plan: null
    }
  }

  const plan = parsed.data
  const violations: MemeEvalViolation[] = []
  const expectation = fixture.expectations
  const captionText = plan.caption_lines.map(({ text }) => text).join('\n')
  const knownImageIds = new Set(fixture.images.map(({ id }) => id))

  if (plan.fixture_id !== fixture.id) {
    addViolation(
      violations,
      'fixture.id',
      `Expected fixture ${fixture.id}, received ${plan.fixture_id}`
    )
  }

  if (plan.ai_bridges.length !== 1) {
    addViolation(
      violations,
      'concept.single',
      `Expected one AI bridge, received ${plan.ai_bridges.length}`
    )
  }

  if (
    expectation.ai_concept &&
    normalize(plan.ai_bridges[0]?.concept ?? '') !==
      normalize(expectation.ai_concept)
  ) {
    addViolation(
      violations,
      'concept.expected',
      `Expected the bridge ${expectation.ai_concept}`
    )
  }

  if (!expectation.allowed_formats.includes(plan.format)) {
    addViolation(
      violations,
      'format.expected',
      `Format ${plan.format} is outside this fixture's native formats`
    )
  }

  if (!expectation.allowed_templates.includes(plan.presentation.template)) {
    addViolation(
      violations,
      'presentation.template',
      `Template ${plan.presentation.template} is outside the expected presentation family`
    )
  }

  if (!expectation.allowed_frame_modes.includes(plan.presentation.frame_mode)) {
    addViolation(
      violations,
      'presentation.frame-mode',
      `Frame mode ${plan.presentation.frame_mode} bypasses the expected fallback stage`
    )
  }

  if (
    plan.caption_lines.length < (expectation.minimum_caption_lines ?? 1) ||
    plan.caption_lines.length > (expectation.maximum_caption_lines ?? 6)
  ) {
    addViolation(
      violations,
      'caption.line-count',
      `Caption has ${plan.caption_lines.length} semantic lines`
    )
  }

  if (
    expectation.exact_caption_lines &&
    !arraysEqual(
      plan.caption_lines.map(({ text }) => text),
      expectation.exact_caption_lines
    )
  ) {
    addViolation(
      violations,
      'caption.exact-copy',
      'User-supplied or canonical locked copy changed'
    )
  }

  for (const [lineIndexText, expectedLine] of Object.entries(
    expectation.exact_caption_lines_by_index ?? {}
  )) {
    const lineIndex = Number(lineIndexText)
    if (plan.caption_lines[lineIndex]?.text !== expectedLine) {
      addViolation(
        violations,
        'caption.exact-copy',
        `Human-retained caption line ${lineIndex} changed`
      )
    }
  }

  const rejectedDirection = fixture.request.rejected_direction
  if (
    expectation.require_rejected_caption_change &&
    rejectedDirection &&
    semanticCaptionKey(captionText) ===
      semanticCaptionKey(rejectedDirection.caption_lines.join('\n'))
  ) {
    addViolation(
      violations,
      'revision.rejected-caption',
      'Caption reproduces the human-rejected direction'
    )
  }

  if (
    expectation.require_rejected_format_change &&
    rejectedDirection &&
    plan.format === rejectedDirection.format
  ) {
    addViolation(
      violations,
      'revision.rejected-format',
      `Terminal dislike retained the rejected ${rejectedDirection.format} format`
    )
  }

  if (
    expectation.required_line_kinds &&
    !arraysEqual(
      plan.caption_lines.map(({ kind }) => kind),
      expectation.required_line_kinds
    )
  ) {
    addViolation(
      violations,
      'caption.line-kind',
      'Caption provenance does not match the supplied quote or rewrite status'
    )
  }

  for (const alternatives of expectation.required_caption_terms ?? []) {
    if (!alternatives.some((term) => includesNormalized(captionText, term))) {
      addViolation(
        violations,
        'caption.required-term',
        `Caption is missing one of: ${alternatives.join(' | ')}`
      )
    }
  }

  for (const term of expectation.forbidden_caption_terms ?? []) {
    if (includesNormalized(captionText, term)) {
      addViolation(
        violations,
        'caption.forbidden-term',
        `Caption reuses the rejected or generic ingredient ${JSON.stringify(term)}`
      )
    }
  }

  if (
    expectation.maximum_caption_words !== undefined &&
    wordCount(captionText) > expectation.maximum_caption_words
  ) {
    addViolation(
      violations,
      'caption.word-count',
      `Caption has ${wordCount(captionText)} words; maximum is ${expectation.maximum_caption_words}`
    )
  }

  if (expectation.omit_cosmetic_terminal_periods !== false) {
    plan.caption_lines.forEach(({ text }, lineIndex) => {
      if (stripTerminalMemePeriod(text) !== text) {
        addViolation(
          violations,
          'caption.terminal-period',
          `Caption line ${lineIndex} ends in a cosmetic period`
        )
      }
    })
  }

  const actualFrames = plan.presentation.source_frames
  if (!objectsEqual(actualFrames, expectation.expected_source_frames)) {
    addViolation(
      violations,
      'frame.expected',
      'Source frames or their semantic order do not match the fixture'
    )
  }

  for (const frame of actualFrames) {
    if (!knownImageIds.has(frame.image_id)) {
      addViolation(
        violations,
        'frame.known-image',
        `Unknown source frame ${frame.image_id}`
      )
    }
  }

  if (
    expectation.require_distinct_source_frames &&
    new Set(actualFrames.map(({ image_id }) => image_id)).size !==
      actualFrames.length
  ) {
    addViolation(
      violations,
      'frame.distinct',
      'A state contrast must use two genuinely different frames'
    )
  }

  const expectedFrameCount = plan.presentation.template === 'diptych' ? 2 : 1
  if (actualFrames.length !== expectedFrameCount) {
    addViolation(
      violations,
      'frame.template-count',
      `${plan.presentation.template} requires ${expectedFrameCount} source frame${expectedFrameCount === 1 ? '' : 's'}; received ${actualFrames.length}`
    )
  }

  if (
    plan.format === 'state contrast' &&
    (plan.presentation.template !== 'diptych' ||
      actualFrames.length !== 2 ||
      new Set(actualFrames.map(({ image_id }) => image_id)).size !== 2)
  ) {
    addViolation(
      violations,
      'format.state-contrast',
      'A state contrast requires a diptych with two distinct source images'
    )
  }

  const requiredRegions = new Set(expectation.required_region_ids ?? [])
  const acknowledgedRegions = new Set(plan.recognition_hinge.region_ids)
  for (const regionId of requiredRegions) {
    if (!acknowledgedRegions.has(regionId)) {
      addViolation(
        violations,
        'hinge.acknowledged',
        `Recognition hinge omits protected region ${regionId}`
      )
    }
  }

  if (
    expectation.maximum_zones !== undefined &&
    plan.presentation.zones.length > expectation.maximum_zones
  ) {
    addViolation(
      violations,
      'layout.zones',
      `Presentation uses ${plan.presentation.zones.length} zones`
    )
  }

  const linePlacements = new Map<
    number,
    { zoneIndex: number; indent: number }[]
  >()

  plan.presentation.zones.forEach((zone, zoneIndex) => {
    if (zone.indent_levels.length !== zone.line_indexes.length) {
      addViolation(
        violations,
        'typography.indentation',
        `Zone ${zone.id} does not assign one indentation level per semantic line`
      )
    }

    zone.line_indexes.forEach((lineIndex, index) => {
      const placements = linePlacements.get(lineIndex) ?? []
      placements.push({
        zoneIndex,
        indent: zone.indent_levels[index] ?? -1
      })
      linePlacements.set(lineIndex, placements)
    })

    if (
      expectation.minimum_font_size_pct !== undefined &&
      zone.font_size_pct < expectation.minimum_font_size_pct
    ) {
      addViolation(
        violations,
        'typography.size',
        `Zone ${zone.id} uses ${zone.font_size_pct}% type; minimum is ${expectation.minimum_font_size_pct}%`
      )
    }

    if (
      expectation.minimum_zone_width_pct !== undefined &&
      zone.bounds_pct[2] < expectation.minimum_zone_width_pct
    ) {
      addViolation(
        violations,
        'layout.zone-width',
        `Zone ${zone.id} is ${zone.bounds_pct[2]}% wide; minimum is ${expectation.minimum_zone_width_pct}%`
      )
    }

    if (
      expectation.maximum_rendered_lines_per_zone !== undefined &&
      zone.rendered_line_count > expectation.maximum_rendered_lines_per_zone
    ) {
      addViolation(
        violations,
        'typography.rendered-lines',
        `Zone ${zone.id} wraps to ${zone.rendered_line_count} rendered lines`
      )
    }

    const textLayout = layoutMemeTextZone(plan.caption_lines, zone)
    const actualRenderedLineCount = textLayout.lines.length
    const requiredRenderedLineCount = Math.max(
      zone.rendered_line_count,
      actualRenderedLineCount
    )
    const minimumHeightPct =
      ((requiredRenderedLineCount * textLayout.lineHeight) /
        memeEvalCanvas.height) *
      100
    if (minimumHeightPct > zone.bounds_pct[3] + 0.25) {
      addViolation(
        violations,
        'typography.vertical-fit',
        `Zone ${zone.id} needs about ${minimumHeightPct.toFixed(1)}% canvas height but declares ${zone.bounds_pct[3]}%`
      )
    }

    if (!slotMatchesBounds(zone.slot, zone.bounds_pct)) {
      addViolation(
        violations,
        'layout.slot-geometry',
        `Zone ${zone.id} is labeled ${zone.slot} but its bounds occupy another canvas region`
      )
    }

    if (zone.rendered_line_count < actualRenderedLineCount) {
      addViolation(
        violations,
        'typography.impossible-wrap',
        `Zone ${zone.id} claims ${zone.rendered_line_count} rendered lines but the renderer produces ${actualRenderedLineCount}`
      )
    }

    if (
      expectation.allowed_backdrops &&
      !expectation.allowed_backdrops.includes(zone.backdrop)
    ) {
      addViolation(
        violations,
        'layout.backdrop',
        `Backdrop ${zone.backdrop} is not justified for ${zone.id}`
      )
    }

    if (
      expectation.allowed_contrast &&
      !expectation.allowed_contrast.includes(zone.contrast)
    ) {
      addViolation(
        violations,
        'layout.contrast',
        `Contrast treatment ${zone.contrast} is not valid for ${zone.id}`
      )
    }

    if (!contrastMatchesBackdrop(zone.contrast, zone.backdrop)) {
      addViolation(
        violations,
        'layout.contrast',
        `Zone ${zone.id} declares contradictory contrast and backdrop treatments`
      )
    }

    if (
      zone.palette === 'orange-white' &&
      (zone.backdrop !== 'solid-panel' || zone.contrast !== 'solid-panel')
    ) {
      addViolation(
        violations,
        'layout.palette',
        `Zone ${zone.id} requests orange-white without a solid panel`
      )
    }
  })

  if (
    expectation.required_palette &&
    !plan.presentation.zones.some(
      ({ palette }) => palette === expectation.required_palette
    )
  ) {
    addViolation(
      violations,
      'layout.palette',
      `Human feedback requires the ${expectation.required_palette} treatment`
    )
  }

  plan.caption_lines.forEach((_, lineIndex) => {
    if (linePlacements.get(lineIndex)?.length !== 1) {
      addViolation(
        violations,
        'layout.line-coverage',
        `Caption line ${lineIndex} must appear in exactly one visual zone`
      )
    }
  })

  for (const lineIndex of linePlacements.keys()) {
    if (lineIndex >= plan.caption_lines.length) {
      addViolation(
        violations,
        'layout.line-coverage',
        `Visual zones refer to missing caption line ${lineIndex}`
      )
    }
  }

  if (expectation.separate_line_zones) {
    const usedZoneIndexes = plan.caption_lines.flatMap((_, lineIndex) =>
      (linePlacements.get(lineIndex) ?? []).map(({ zoneIndex }) => zoneIndex)
    )
    if (new Set(usedZoneIndexes).size !== plan.caption_lines.length) {
      addViolation(
        violations,
        'layout.semantic-zones',
        'Setup and payoff collapsed into the same visual zone'
      )
    }
  }

  for (const [lineIndexText, allowedSlots] of Object.entries(
    expectation.required_line_slots ?? {}
  )) {
    const lineIndex = Number(lineIndexText)
    const placement = linePlacements.get(lineIndex)?.[0]
    const actualSlot =
      placement === undefined
        ? undefined
        : plan.presentation.zones[placement.zoneIndex]?.slot
    if (!actualSlot || !allowedSlots.includes(actualSlot)) {
      addViolation(
        violations,
        'layout.slot',
        `Caption line ${lineIndex} belongs in ${allowedSlots.join(' or ')}`
      )
    }
  }

  for (const [lineIndexText, expectedAnchor] of Object.entries(
    expectation.required_zone_anchors ?? {}
  )) {
    const lineIndex = Number(lineIndexText)
    const placement = linePlacements.get(lineIndex)?.[0]
    const actualAnchor =
      placement === undefined
        ? undefined
        : plan.presentation.zones[placement.zoneIndex]?.anchor_region_id
    if (actualAnchor !== expectedAnchor) {
      addViolation(
        violations,
        'layout.anchor',
        `Caption line ${lineIndex} must attach to ${expectedAnchor}`
      )
    }
  }

  expectation.indent_levels_by_line?.forEach((expectedIndent, lineIndex) => {
    const placements = linePlacements.get(lineIndex) ?? []
    if (placements.length !== 1 || placements[0]?.indent !== expectedIndent) {
      addViolation(
        violations,
        'typography.indentation',
        `Caption line ${lineIndex} requires indentation level ${expectedIndent}`
      )
    }
  })

  const maximumZoneOverlap = expectation.maximum_zone_overlap_ratio
  if (maximumZoneOverlap !== undefined) {
    forEachPair(plan.presentation.zones, (left, right) => {
      const ratio = overlapRatio(left.bounds_pct, right.bounds_pct, 'minimum')
      if (ratio > maximumZoneOverlap) {
        addViolation(
          violations,
          'layout.zone-overlap',
          `Zones ${left.id} and ${right.id} overlap by ${formatRatio(ratio)}`
        )
      }
    })
  }

  const maximumProtectedOverlap = expectation.maximum_protected_overlap_ratio
  if (maximumProtectedOverlap !== undefined) {
    const usedImages = new Set(actualFrames.map(({ image_id }) => image_id))
    for (const region of fixture.protected_regions) {
      if (region.priority !== 'must' || !usedImages.has(region.image_id)) {
        continue
      }

      for (const zone of plan.presentation.zones) {
        const ratio = overlapRatio(
          zone.bounds_pct,
          region.canvas_rect_pct,
          'right'
        )
        if (ratio > maximumProtectedOverlap) {
          addViolation(
            violations,
            'layout.protected-region',
            `Zone ${zone.id} covers ${formatRatio(ratio)} of ${region.label}`
          )
        }
      }
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    plan
  }
}

export function summarizeViolations(result: MemeEvalResult): string {
  if (result.pass) return 'pass'
  return result.violations
    .map(({ code, message }) => `- ${code}: ${message}`)
    .join('\n')
}

function addViolation(
  violations: MemeEvalViolation[],
  code: MemeEvalViolationCode,
  message: string
) {
  if (
    violations.some(
      (violation) => violation.code === code && violation.message === message
    )
  ) {
    return
  }
  violations.push({ code, message })
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function includesNormalized(value: string, search: string): boolean {
  return normalize(value).includes(normalize(search))
}

function semanticCaptionKey(value: string): string {
  return normalize(value).replaceAll(/[^\p{L}\p{N}]+/gu, '')
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  )
}

function objectsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'_.-]*/gu)?.length ?? 0
}

function contrastMatchesBackdrop(
  contrast: MemeEvalPlan['presentation']['zones'][number]['contrast'],
  backdrop: MemeEvalPlan['presentation']['zones'][number]['backdrop']
): boolean {
  if (contrast === 'edge-gradient') return backdrop === 'edge-gradient'
  if (contrast === 'solid-panel') return backdrop === 'solid-panel'
  if (contrast === 'source-native') return backdrop === 'source-native'
  return backdrop === 'none'
}

function slotMatchesBounds(
  slot: MemeEvalPlan['presentation']['zones'][number]['slot'],
  [x, y, width, height]: PercentageRect
): boolean {
  const centerX = x + width / 2
  const centerY = y + height / 2
  switch (slot) {
    case 'top':
      return centerY < 50
    case 'bottom':
      return centerY >= 50
    case 'top-left':
      return centerX < 50 && centerY < 50
    case 'top-right':
      return centerX >= 50 && centerY < 50
    case 'bottom-left':
      return centerX < 50 && centerY >= 50
    case 'bottom-right':
      return centerX >= 50 && centerY >= 50
    case 'panel-left':
      return centerX < 50
    case 'panel-right':
      return centerX >= 50
    case 'full':
      return true
  }
}

function forEachPair<T>(
  items: readonly T[],
  visit: (left: T, right: T) => void
) {
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < items.length;
      rightIndex += 1
    ) {
      visit(items[leftIndex]!, items[rightIndex]!)
    }
  }
}

function overlapRatio(
  left: PercentageRect,
  right: PercentageRect,
  denominator: 'minimum' | 'right'
): number {
  const intersection = intersectionArea(left, right)
  if (intersection === 0) return 0
  const denominatorArea =
    denominator === 'right'
      ? rectArea(right)
      : Math.min(rectArea(left), rectArea(right))
  return intersection / denominatorArea
}

function intersectionArea(left: PercentageRect, right: PercentageRect): number {
  const [leftX, leftY, leftWidth, leftHeight] = left
  const [rightX, rightY, rightWidth, rightHeight] = right
  const width = Math.max(
    0,
    Math.min(leftX + leftWidth, rightX + rightWidth) - Math.max(leftX, rightX)
  )
  const height = Math.max(
    0,
    Math.min(leftY + leftHeight, rightY + rightHeight) - Math.max(leftY, rightY)
  )
  return width * height
}

function rectArea([, , width, height]: PercentageRect): number {
  return width * height
}

function formatRatio(value: number): string {
  return `${Math.round(value * 100)}%`
}

function zodIssueSummary(
  issues: readonly { readonly path: PropertyKey[]; readonly message: string }[]
): string {
  return issues
    .slice(0, 5)
    .map(({ path, message }) => `${path.join('.') || 'output'}: ${message}`)
    .join('; ')
}
