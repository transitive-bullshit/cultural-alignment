import { z } from 'zod'

import {
  memeEvalCaptionKindSchema,
  memeEvalFormatSchema,
  memeEvalFrameRoleSchema,
  type MemeEvalPlan
} from './schema'

export const semanticMemeModeSchema = z.enum([
  'single',
  'setup-payoff',
  'dialogue',
  'state-contrast',
  'source-native'
])

export const semanticCaptionRoleSchema = z.enum([
  'only',
  'setup',
  'payoff',
  'speech',
  'label',
  'code',
  'status'
])

export const semanticMemeIntentSchema = z
  .object({
    version: z.literal(2),
    fixture_id: z.string().trim().min(1),
    recognition_hinge: z
      .object({
        description: z.string().trim().min(1),
        region_ids: z.array(z.string().trim().min(1)).max(8)
      })
      .strict(),
    ai_bridge: z
      .object({
        concept: z.string().trim().min(1),
        connection: z.string().trim().min(1)
      })
      .strict(),
    caption_lines: z
      .array(
        z
          .object({
            text: z
              .string()
              .min(1)
              .refine(
                (value) =>
                  value === value.trim() && !/[\t\r\n\v\f]| {2}/u.test(value),
                'Caption beats use single spaces; indentation is semantic'
              ),
            kind: memeEvalCaptionKindSchema,
            role: semanticCaptionRoleSchema,
            anchor_region_id: z.string().trim().min(1).nullable(),
            indent_level: z.number().int().min(0).max(8)
          })
          .strict()
      )
      .min(1)
      .max(6),
    format: memeEvalFormatSchema,
    presentation: z
      .object({
        mode: semanticMemeModeSchema,
        source_frames: z
          .array(
            z
              .object({
                image_id: z.string().trim().min(1),
                role: memeEvalFrameRoleSchema
              })
              .strict()
          )
          .min(1)
          .max(2),
        preferred_edge: z.enum(['auto', 'top', 'bottom']),
        palette: z.enum(['default', 'orange-white'])
      })
      .strict(),
    why_it_works: z.string().trim().min(1)
  })
  .strict()
  .superRefine(({ caption_lines, format, presentation }, context) => {
    const frameCount = presentation.source_frames.length
    if (presentation.mode === 'state-contrast' && frameCount !== 2) {
      context.addIssue({
        code: 'custom',
        path: ['presentation', 'source_frames'],
        message: 'State contrast requires exactly two source frames'
      })
    }
    if (presentation.mode === 'state-contrast' && caption_lines.length !== 2) {
      context.addIssue({
        code: 'custom',
        path: ['caption_lines'],
        message: 'State contrast requires exactly two caption beats'
      })
    }
    if (presentation.mode !== 'state-contrast' && frameCount !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['presentation', 'source_frames'],
        message: 'This semantic mode requires exactly one source frame'
      })
    }
    if (
      (format === 'state contrast') !==
      (presentation.mode === 'state-contrast')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['presentation', 'mode'],
        message: 'State-contrast format and semantic mode must agree'
      })
    }
    const roles = caption_lines.map(({ role }) => role)
    if (presentation.mode === 'single' && caption_lines.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['caption_lines'],
        message: 'Single mode requires exactly one caption beat'
      })
    }
    if (
      presentation.mode === 'setup-payoff' &&
      (caption_lines.length !== 2 ||
        roles[0] !== 'setup' ||
        roles[1] !== 'payoff')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['caption_lines'],
        message: 'Setup-payoff requires exactly one setup then one payoff'
      })
    }
    if (
      presentation.mode === 'dialogue' &&
      (caption_lines.length !== 2 ||
        caption_lines.some(
          ({ role, anchor_region_id }) =>
            role !== 'speech' || anchor_region_id === null
        ))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['caption_lines'],
        message: 'Dialogue lines require speech roles and speaker anchors'
      })
    }
    if (
      presentation.mode === 'state-contrast' &&
      (roles[0] !== 'setup' || roles[1] !== 'payoff')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['caption_lines'],
        message: 'State contrast requires before/setup then after/payoff'
      })
    }
    const frameRoles = presentation.source_frames.map(({ role }) => role)
    if (
      presentation.mode === 'state-contrast' &&
      (frameRoles[0] !== 'before' ||
        frameRoles[1] !== 'after' ||
        presentation.source_frames[0]?.image_id ===
          presentation.source_frames[1]?.image_id)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['presentation', 'source_frames'],
        message: 'State contrast requires distinct before and after frames'
      })
    }
    if (
      presentation.mode !== 'state-contrast' &&
      frameRoles.some((role) => role !== 'single')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['presentation', 'source_frames'],
        message: 'Single-frame modes require the single source role'
      })
    }
  })

export type SemanticMemeIntent = z.infer<typeof semanticMemeIntentSchema>

export function semanticIntentFromLegacyPlan(
  plan: MemeEvalPlan
): SemanticMemeIntent {
  const placementByLine = new Map(
    plan.presentation.zones.flatMap((zone) =>
      zone.line_indexes.map((lineIndex, position) => [
        lineIndex,
        {
          zone,
          indentLevel: zone.indent_levels[position] ?? 0
        }
      ])
    )
  )
  const mode = semanticModeFromLegacyPlan(plan)

  return semanticMemeIntentSchema.parse({
    version: 2,
    fixture_id: plan.fixture_id,
    recognition_hinge: plan.recognition_hinge,
    ai_bridge: plan.ai_bridges[0]!,
    caption_lines: plan.caption_lines.map((line, index) => {
      const placement = placementByLine.get(index)
      return {
        ...line,
        role: semanticRoleForLine(plan, mode, index, placement?.zone.style),
        anchor_region_id: placement?.zone.anchor_region_id ?? null,
        indent_level: placement?.indentLevel ?? 0
      }
    }),
    format: plan.format,
    presentation: {
      mode,
      source_frames: plan.presentation.source_frames,
      preferred_edge: preferredEdge(plan),
      palette: plan.presentation.zones.some(
        ({ palette }) => palette === 'orange-white'
      )
        ? 'orange-white'
        : 'default'
    },
    why_it_works: plan.why_it_works
  })
}

function semanticModeFromLegacyPlan(
  plan: MemeEvalPlan
): SemanticMemeIntent['presentation']['mode'] {
  if (plan.format === 'state contrast') return 'state-contrast'
  if (plan.format === 'dialogue') return 'dialogue'
  if (plan.format === 'source-native interface') return 'source-native'
  if (plan.caption_lines.length > 1) return 'setup-payoff'
  return 'single'
}

function semanticRoleForLine(
  plan: MemeEvalPlan,
  mode: SemanticMemeIntent['presentation']['mode'],
  index: number,
  style: MemeEvalPlan['presentation']['zones'][number]['style'] | undefined
): SemanticMemeIntent['caption_lines'][number]['role'] {
  if (mode === 'single') return 'only'
  if (mode === 'dialogue') return 'speech'
  if (mode === 'source-native') {
    if (style === 'code') return 'code'
    if (style === 'label') return 'label'
    return 'status'
  }
  if (mode === 'state-contrast') return index === 0 ? 'setup' : 'payoff'
  return index === plan.caption_lines.length - 1 ? 'payoff' : 'setup'
}

function preferredEdge(
  plan: MemeEvalPlan
): SemanticMemeIntent['presentation']['preferred_edge'] {
  const slots = plan.presentation.zones.map(({ slot }) => slot)
  if (slots.every((slot) => slot.startsWith('top'))) return 'top'
  if (slots.every((slot) => slot.startsWith('bottom'))) return 'bottom'
  return 'auto'
}
