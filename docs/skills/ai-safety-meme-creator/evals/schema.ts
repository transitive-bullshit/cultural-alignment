import { z } from 'zod'

export const memeEvalFormatSchema = z.enum([
  'canon',
  'relabel',
  'collision',
  'dialogue',
  'state contrast',
  'source-native interface'
])

export const memeEvalTemplateSchema = z.enum([
  'overlay',
  'dialogue',
  'diptych',
  'interface',
  'band-top',
  'band-bottom',
  'sidecar-left',
  'sidecar-right'
])

export const memeEvalFrameModeSchema = z.enum(['cover', 'contain', 'extend'])

export const memeEvalSlotSchema = z.enum([
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'panel-left',
  'panel-right',
  'full'
])

export const memeEvalFrameRoleSchema = z.enum([
  'single',
  'before',
  'after',
  'left-speaker',
  'right-speaker'
])

export const memeEvalCaptionKindSchema = z.enum([
  'canonical-quote',
  'intentional-rewrite',
  'original'
])

export const memeEvalZoneStyleSchema = z.enum([
  'impact',
  'dialogue',
  'code',
  'label',
  'status'
])

export const memeEvalBackdropSchema = z.enum([
  'none',
  'edge-gradient',
  'solid-panel',
  'source-native'
])

export const memeEvalContrastSchema = z.enum([
  'outlined',
  'edge-gradient',
  'solid-panel',
  'source-native'
])

export const memeEvalPaletteSchema = z.enum(['default', 'orange-white'])

const percentageRectSchema = z
  .tuple([
    z.number().min(0).max(100),
    z.number().min(0).max(100),
    z.number().positive().max(100),
    z.number().positive().max(100)
  ])
  .superRefine(([x, y, width, height], context) => {
    if (x + width > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Rectangle extends beyond the right canvas edge'
      })
    }

    if (y + height > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Rectangle extends beyond the bottom canvas edge'
      })
    }
  })

export const memeEvalPlanSchema = z
  .object({
    version: z.literal(1),
    fixture_id: z.string().trim().min(1),
    recognition_hinge: z
      .object({
        description: z.string().trim().min(1),
        region_ids: z.array(z.string().trim().min(1)).max(8)
      })
      .strict(),
    ai_bridges: z
      .array(
        z
          .object({
            concept: z.string().trim().min(1),
            connection: z.string().trim().min(1)
          })
          .strict()
      )
      .min(1)
      .max(3),
    caption_lines: z
      .array(
        z
          .object({
            text: z.string().trim().min(1),
            kind: memeEvalCaptionKindSchema
          })
          .strict()
      )
      .min(1)
      .max(6),
    format: memeEvalFormatSchema,
    presentation: z
      .object({
        template: memeEvalTemplateSchema,
        frame_mode: memeEvalFrameModeSchema,
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
        zones: z
          .array(
            z
              .object({
                id: z.string().trim().min(1),
                line_indexes: z.array(z.number().int().min(0).max(5)).min(1),
                slot: memeEvalSlotSchema,
                bounds_pct: percentageRectSchema,
                font_size_pct: z.number().positive().max(20),
                rendered_line_count: z.number().int().positive().max(12),
                style: memeEvalZoneStyleSchema,
                backdrop: memeEvalBackdropSchema,
                contrast: memeEvalContrastSchema,
                palette: memeEvalPaletteSchema,
                anchor_region_id: z.string().trim().min(1).nullable(),
                indent_levels: z.array(z.number().int().min(0).max(8)).min(1)
              })
              .strict()
          )
          .min(1)
          .max(6)
      })
      .strict(),
    why_it_works: z.string().trim().min(1)
  })
  .strict()

const feedbackSourceSchema = z
  .object({
    path: z.string().trim().min(1),
    idea_id: z.string().trim().min(1),
    rating: z.enum(['like', 'neutral', 'dislike', 'unrated']),
    note_includes: z.string().trim().min(1)
  })
  .strict()

const fixtureImageSchema = z
  .object({
    id: z.string().trim().min(1),
    path: z.string().trim().min(1),
    description: z.string().trim().min(1)
  })
  .strict()

const protectedRegionSchema = z
  .object({
    id: z.string().trim().min(1),
    image_id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    canvas_rect_pct: percentageRectSchema,
    priority: z.enum(['must', 'soft'])
  })
  .strict()

const expectedSourceFrameSchema = z
  .object({
    image_id: z.string().trim().min(1),
    role: memeEvalFrameRoleSchema
  })
  .strict()

const fixtureExpectationsSchema = z
  .object({
    ai_concept: z.string().trim().min(1).optional(),
    minimum_caption_lines: z.number().int().positive().max(6).optional(),
    maximum_caption_lines: z.number().int().positive().max(6).optional(),
    maximum_caption_words: z.number().int().positive().optional(),
    maximum_zones: z.number().int().positive().max(6).optional(),
    omit_cosmetic_terminal_periods: z.boolean().optional(),
    exact_caption_lines: z.array(z.string().min(1)).min(1).max(6).optional(),
    exact_caption_lines_by_index: z
      .record(z.string(), z.string().min(1))
      .optional(),
    require_rejected_caption_change: z.boolean().optional(),
    require_rejected_format_change: z.boolean().optional(),
    required_caption_terms: z
      .array(z.array(z.string().trim().min(1)).min(1))
      .optional(),
    forbidden_caption_terms: z.array(z.string().trim().min(1)).optional(),
    allowed_formats: z.array(memeEvalFormatSchema).min(1),
    allowed_templates: z.array(memeEvalTemplateSchema).min(1),
    allowed_frame_modes: z.array(memeEvalFrameModeSchema).min(1),
    expected_source_frames: z.array(expectedSourceFrameSchema).min(1).max(2),
    required_line_slots: z
      .record(z.string(), z.array(memeEvalSlotSchema).min(1))
      .optional(),
    required_zone_anchors: z.record(z.string(), z.string()).optional(),
    separate_line_zones: z.boolean().optional(),
    maximum_zone_overlap_ratio: z.number().min(0).max(1).optional(),
    maximum_protected_overlap_ratio: z.number().min(0).max(1).optional(),
    required_region_ids: z.array(z.string().trim().min(1)).optional(),
    minimum_font_size_pct: z.number().positive().max(20).optional(),
    minimum_zone_width_pct: z.number().positive().max(100).optional(),
    maximum_rendered_lines_per_zone: z.number().int().positive().optional(),
    allowed_backdrops: z.array(memeEvalBackdropSchema).min(1).optional(),
    allowed_contrast: z.array(memeEvalContrastSchema).min(1).optional(),
    required_palette: memeEvalPaletteSchema.optional(),
    required_line_kinds: z.array(memeEvalCaptionKindSchema).min(1).optional(),
    indent_levels_by_line: z.array(z.number().int().min(0).max(8)).optional(),
    require_distinct_source_frames: z.boolean().optional()
  })
  .strict()

export const memeSkillFixtureSchema = z
  .object({
    id: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).min(1),
    request: z
      .object({
        source_title: z.string().trim().min(1),
        scene: z.string().trim().min(1),
        ai_concepts: z.array(z.string().trim().min(1)).min(1),
        caveats: z.array(z.string().trim().min(1)),
        user_direction: z.string().trim().min(1).nullable(),
        rejected_direction: z
          .object({
            caption_lines: z.array(z.string().trim().min(1)).min(1),
            format: memeEvalFormatSchema,
            feedback: z.string().trim().min(1)
          })
          .strict()
          .nullable()
      })
      .strict(),
    images: z.array(fixtureImageSchema).min(1).max(2),
    protected_regions: z.array(protectedRegionSchema),
    expectations: fixtureExpectationsSchema,
    feedback_sources: z.array(feedbackSourceSchema).min(1)
  })
  .strict()

export const memeSkillFixtureCollectionSchema = z.array(memeSkillFixtureSchema)

export type MemeEvalPlan = z.infer<typeof memeEvalPlanSchema>
export type MemeEvalFrameMode = z.infer<typeof memeEvalFrameModeSchema>
export type MemeEvalTemplate = z.infer<typeof memeEvalTemplateSchema>
export type MemeEvalSlot = z.infer<typeof memeEvalSlotSchema>
export type MemeSkillFixture = z.infer<typeof memeSkillFixtureSchema>
