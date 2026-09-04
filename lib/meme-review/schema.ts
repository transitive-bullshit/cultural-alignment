import { z } from 'zod'

export const memeFormatSchema = z.enum([
  'canon',
  'relabel',
  'collision',
  'dialogue',
  'state contrast',
  'source-native interface'
])

export const memePreviewLayoutV1Schema = z.enum([
  'top',
  'bottom',
  'top-bottom',
  'dialogue',
  'split',
  'label',
  'interface'
])

export const memeCritiqueV1Schema = z.object({
  verdict: z.enum(['keep', 'revise']),
  predicted_rating: z.enum(['dislike', 'neutral', 'like']),
  confidence: z.number().min(0).max(1),
  expected_feedback: z.string().trim().min(1),
  strongest_quality: z.string().trim().min(1),
  main_risk: z.string().trim().min(1),
  glance_test: z.object({
    source: z.literal(true),
    analogy: z.literal(true),
    meme: z.literal(true),
    visual: z.literal(true)
  })
})

const memeIdeaCoreSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--\d{2,}$/),
  ai_concept: z.string().trim().min(1),
  display_context: z.literal('standalone'),
  source_anchor: z.string().trim().min(1),
  caption_lines: z.array(z.string().trim().min(1)).min(1).max(4),
  format: memeFormatSchema,
  frame_guidance: z.string().trim().min(1),
  why_it_works: z.string().trim().min(1)
})

export const memeIdeaV1Schema = memeIdeaCoreSchema
  .extend({
    preview: z.object({
      layout: memePreviewLayoutV1Schema,
      image: z.enum(['curated', 'alternate-needed']),
      alternate_image_query: z.string().trim().min(1).nullable()
    }),
    critic: memeCritiqueV1Schema
  })
  .superRefine(({ preview }, context) => {
    if (
      (preview.image === 'curated' && preview.alternate_image_query !== null) ||
      (preview.image === 'alternate-needed' &&
        preview.alternate_image_query === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Alternate frame proposals require one search brief',
        path: ['preview', 'alternate_image_query']
      })
    }
  })

const scoreSchema = z.number().int().min(1).max(5)

export const memeCritiqueV2Schema = memeCritiqueV1Schema.extend({
  scores: z.object({
    scene_hinge: scoreSchema,
    ai_payoff: scoreSchema,
    parsing_ease: scoreSchema,
    visual_proof: scoreSchema,
    source_accuracy: scoreSchema
  }),
  calibration: z.object({
    closest_liked_id: z.string().trim().min(1).nullable(),
    contrast_disliked_id: z.string().trim().min(1).nullable()
  })
})

export const memePreviewTemplateV2Schema = z.enum([
  'overlay',
  'band-top',
  'band-bottom',
  'sidecar-left',
  'sidecar-right',
  'dialogue',
  'diptych',
  'interface'
])

export const memePreviewSlotV2Schema = z.enum([
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left-rail',
  'right-rail',
  'panel-left',
  'panel-right',
  'full'
])

export const memePreviewZoneV2Schema = z.object({
  lines: z.array(z.number().int().min(0).max(3)).min(1).max(4),
  slot: memePreviewSlotV2Schema,
  style: z.enum(['impact', 'plain', 'dialogue', 'label', 'code', 'status']),
  backdrop: z.enum(['edge-gradient']).optional(),
  align: z.enum(['left', 'center', 'right']),
  casing: z.enum(['preserve', 'uppercase']),
  size: z.enum(['display', 'hero', 'standard', 'compact']),
  width: z.enum(['wide']).optional(),
  indent_levels: z.array(z.number().int().min(0).max(4)).min(1).max(4)
})

export const memePreviewV2Schema = z.object({
  renderer: z.literal(2),
  template: memePreviewTemplateV2Schema,
  frame_mode: z.enum(['cover', 'contain-black', 'contain-blur', 'inset-blur']),
  asset_ids: z.array(z.string().trim().min(1)).min(1).max(2),
  zones: z.array(memePreviewZoneV2Schema).min(1).max(4)
})

export const memeIdeaV2Schema = memeIdeaCoreSchema
  .extend({
    preview: memePreviewV2Schema,
    critic: memeCritiqueV2Schema
  })
  .superRefine(({ caption_lines, preview }, context) => {
    const requiresTwoAssets = preview.template === 'diptych'

    if (preview.asset_ids.length !== (requiresTwoAssets ? 2 : 1)) {
      context.addIssue({
        code: 'custom',
        message: requiresTwoAssets
          ? 'Diptych previews require two ordered assets'
          : 'Single-frame previews require exactly one asset',
        path: ['preview', 'asset_ids']
      })
    }

    if (new Set(preview.asset_ids).size !== preview.asset_ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Preview asset references must be unique',
        path: ['preview', 'asset_ids']
      })
    }

    const usedLines = new Set<number>()

    preview.zones.forEach((zone, zoneIndex) => {
      if (zone.indent_levels.length !== zone.lines.length) {
        context.addIssue({
          code: 'custom',
          message: 'Every rendered line requires an indentation level',
          path: ['preview', 'zones', zoneIndex, 'indent_levels']
        })
      }

      zone.lines.forEach((line, lineIndex) => {
        if (line >= caption_lines.length) {
          context.addIssue({
            code: 'custom',
            message: `Caption line ${line} does not exist`,
            path: ['preview', 'zones', zoneIndex, 'lines', lineIndex]
          })
        }

        if (usedLines.has(line)) {
          context.addIssue({
            code: 'custom',
            message: `Caption line ${line} is rendered more than once`,
            path: ['preview', 'zones', zoneIndex, 'lines', lineIndex]
          })
        }

        usedLines.add(line)
      })
    })

    caption_lines.forEach((_, line) => {
      if (!usedLines.has(line)) {
        context.addIssue({
          code: 'custom',
          message: `Caption line ${line} is not assigned to a visual zone`,
          path: ['preview', 'zones']
        })
      }
    })
  })

function createScenarioMemeIdeasSchema<T extends z.ZodType>(
  ideaSchema: T,
  options: {
    readonly minimumIdeas?: number
    readonly maximumIdeas?: number
  } = {}
) {
  const minimumIdeas = options.minimumIdeas ?? 1
  const ideasSchema = options.maximumIdeas
    ? z.array(ideaSchema).min(minimumIdeas).max(options.maximumIdeas)
    : z.array(ideaSchema).min(minimumIdeas)

  return z
    .object({
      scenario_slug: z.string().trim().min(1),
      ideas: ideasSchema
    })
    .superRefine(({ scenario_slug, ideas }, context) => {
      for (const idea of ideas as { id: string }[]) {
        if (!idea.id.startsWith(`${scenario_slug}--`)) {
          context.addIssue({
            code: 'custom',
            message: `Idea ${idea.id} must begin with its scenario slug`,
            path: ['ideas']
          })
        }
      }
    })
}

export const scenarioMemeIdeasV1Schema = createScenarioMemeIdeasSchema(
  memeIdeaV1Schema,
  { minimumIdeas: 3, maximumIdeas: 5 }
)
export const scenarioMemeIdeasV2Schema =
  createScenarioMemeIdeasSchema(memeIdeaV2Schema)

function createMemeIdeaCollectionSchema<T extends z.ZodType>(
  scenarioSchema: T
) {
  return z.array(scenarioSchema).superRefine((scenarios, context) => {
    const scenarioSlugs = new Set<string>()
    const ideaIds = new Set<string>()

    ;(
      scenarios as {
        scenario_slug: string
        ideas: { id: string }[]
      }[]
    ).forEach((scenario, scenarioIndex) => {
      if (scenarioSlugs.has(scenario.scenario_slug)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate scenario slug: ${scenario.scenario_slug}`,
          path: [scenarioIndex, 'scenario_slug']
        })
      }
      scenarioSlugs.add(scenario.scenario_slug)

      scenario.ideas.forEach((idea, ideaIndex) => {
        if (ideaIds.has(idea.id)) {
          context.addIssue({
            code: 'custom',
            message: `Duplicate idea id: ${idea.id}`,
            path: [scenarioIndex, 'ideas', ideaIndex, 'id']
          })
        }
        ideaIds.add(idea.id)
      })
    })
  })
}

export const memeIdeaCollectionV1Schema = createMemeIdeaCollectionSchema(
  scenarioMemeIdeasV1Schema
)
export const memeIdeaCollectionV2Schema = createMemeIdeaCollectionSchema(
  scenarioMemeIdeasV2Schema
)

const percentCoordinateSchema = z.number().min(0).max(100)

export const memePercentRectSchema = z
  .tuple([
    percentCoordinateSchema,
    percentCoordinateSchema,
    z.number().positive().max(100),
    z.number().positive().max(100)
  ])
  .superRefine(([left, top, width, height], context) => {
    if (left + width > 100 || top + height > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Percentage rectangles must stay within the source image'
      })
    }
  })

export const memeReviewAssetSchema = z.object({
  id: z.string().trim().min(1),
  scenario_slug: z.string().trim().min(1),
  src: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1),
  blur_data_url: z.string().trim().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  protected_regions: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        kind: z.enum(['face', 'subject', 'prop', 'screen-text', 'gesture']),
        priority: z.enum(['must', 'soft']),
        source_rect: memePercentRectSchema
      })
    )
    .min(1)
    .superRefine((regions, context) => {
      const ids = new Set<string>()

      regions.forEach((region, index) => {
        if (ids.has(region.id)) {
          context.addIssue({
            code: 'custom',
            message: `Duplicate protected region: ${region.id}`,
            path: [index, 'id']
          })
        }
        ids.add(region.id)
      })
    })
})

export const memeReviewAssetCollectionSchema = z
  .array(memeReviewAssetSchema)
  .superRefine((assets, context) => {
    const ids = new Set<string>()

    assets.forEach((asset, index) => {
      if (ids.has(asset.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate meme review asset: ${asset.id}`,
          path: [index, 'id']
        })
      }
      ids.add(asset.id)
    })
  })

export const memeReviewScenarioPreviewV1Schema = z.object({
  scenario_slug: z.string().trim().min(1),
  src: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1),
  blur_data_url: z.string().trim().min(1),
  object_position: z.string().trim().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/)
})

export const memeReviewScenarioPreviewDocumentV1Schema = z
  .object({
    version: z.literal(1),
    round: z.literal(1),
    scenarios: z.array(memeReviewScenarioPreviewV1Schema).min(1)
  })
  .superRefine(({ scenarios }, context) => {
    const scenarioSlugs = new Set<string>()

    scenarios.forEach((scenario, index) => {
      if (scenarioSlugs.has(scenario.scenario_slug)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate archived scenario preview: ${scenario.scenario_slug}`,
          path: ['scenarios', index, 'scenario_slug']
        })
      }
      scenarioSlugs.add(scenario.scenario_slug)
    })
  })

export const memeRatingSchema = z.enum(['dislike', 'neutral', 'like'])
const memeLockRevisionSchema = z.number().int().nonnegative()
const memeFinalizationFingerprintSchema = z
  .string()
  .regex(/^v1-[a-f0-9]{16}-\d+$/)
const memeRevisionKeySchema = z.string().trim().min(1).max(500)

const memeFinalizedVersionSchema = z.object({
  revisionKey: memeRevisionKeySchema,
  payloadFingerprint: memeFinalizationFingerprintSchema
})

const memeFeedbackEntryFields = {
  rating: memeRatingSchema.nullable(),
  notes: z.string().max(4000)
}

export const memeFeedbackEntrySchema = z
  .object({
    ...memeFeedbackEntryFields,
    locked: z.boolean().default(false),
    lockRevision: memeLockRevisionSchema.default(0),
    finalizedVersion: memeFinalizedVersionSchema.optional()
  })
  .superRefine(requireValidPersistedFinalization)

const memeFeedbackPatchEntrySchema = z
  .object({
    ...memeFeedbackEntryFields,
    locked: z.boolean().optional()
  })
  .superRefine(requireLikeWhenLocked)

const memeFeedbackPreconditionSchema = z
  .object({
    ...memeFeedbackEntryFields,
    locked: z.boolean(),
    lockRevision: memeLockRevisionSchema,
    finalizedVersion: memeFinalizedVersionSchema.optional()
  })
  .superRefine(requireValidPersistedFinalization)

export const memeFeedbackDocumentV1Schema = z.object({
  version: z.literal(1),
  updatedAt: z.iso.datetime().nullable(),
  feedback: z.record(z.string(), memeFeedbackEntrySchema)
})

export const memeReviewBatchNumberSchema = z.number().int().positive()
// Legacy name retained for existing callers; the value is no longer hard-coded.
export const activeMemeReviewRoundSchema = memeReviewBatchNumberSchema

export const memeReviewBatchStatusSchema = z
  .object({
    version: z.literal(1),
    batch: memeReviewBatchNumberSchema,
    status: z.enum(['generating', 'ready']),
    message: z.string().trim().min(1),
    updatedAt: z.iso.datetime().nullable(),
    reviewable_scenarios: z.array(z.string().trim().min(1)).default([])
  })
  .superRefine(({ reviewable_scenarios }, context) => {
    const seen = new Set<string>()

    reviewable_scenarios.forEach((scenarioSlug, index) => {
      if (seen.has(scenarioSlug)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate reviewable scenario: ${scenarioSlug}`,
          path: ['reviewable_scenarios', index]
        })
      }
      seen.add(scenarioSlug)
    })
  })

export const memeReviewScenarioStateSchema = z.object({
  disabled: z.literal(true)
})

export const memeReviewStateDocumentSchema = z.object({
  version: z.literal(2),
  round: activeMemeReviewRoundSchema,
  updatedAt: z.iso.datetime().nullable(),
  feedback: z.record(z.string(), memeFeedbackEntrySchema),
  scenarios: z.record(z.string(), memeReviewScenarioStateSchema)
})

export const memeFeedbackPatchSchema = z
  .object({
    ideaId: z.string().trim().min(1),
    feedback: memeFeedbackPatchEntrySchema,
    expectedFeedback: memeFeedbackPreconditionSchema.optional(),
    targetRevisionKey: memeRevisionKeySchema.optional(),
    expectedPayloadFingerprint: memeFinalizationFingerprintSchema.optional()
  })
  .superRefine(
    (
      {
        feedback,
        expectedFeedback,
        targetRevisionKey,
        expectedPayloadFingerprint
      },
      context
    ) => {
      const changesFinalization = feedback.locked !== undefined
      const hasFeedbackPrecondition = expectedFeedback !== undefined
      const hasTargetRevision = targetRevisionKey !== undefined
      const hasPayloadPrecondition = expectedPayloadFingerprint !== undefined

      if (changesFinalization !== hasFeedbackPrecondition) {
        context.addIssue({
          code: 'custom',
          message:
            'Finalization changes require the previously observed feedback revision',
          path: changesFinalization
            ? ['expectedFeedback']
            : ['feedback', 'locked']
        })
      }

      if (changesFinalization !== hasTargetRevision) {
        context.addIssue({
          code: 'custom',
          message:
            'Finalization changes require the selected meme revision key',
          path: changesFinalization
            ? ['targetRevisionKey']
            : ['feedback', 'locked']
        })
      }

      if (changesFinalization !== hasPayloadPrecondition) {
        context.addIssue({
          code: 'custom',
          message:
            'Finalization changes require the previously observed meme payload fingerprint',
          path: changesFinalization
            ? ['expectedPayloadFingerprint']
            : ['feedback', 'locked']
        })
      }
    }
  )

export const memeScenarioPatchSchema = z.object({
  scenarioSlug: z.string().trim().min(1),
  disabled: z.boolean()
})

export const memeReviewBatchPatchSchema = z
  .object({
    round: activeMemeReviewRoundSchema,
    ideaUpdates: z.array(memeFeedbackPatchSchema).max(1000).default([]),
    scenarioUpdates: z.array(memeScenarioPatchSchema).max(500).default([])
  })
  .superRefine(({ ideaUpdates, scenarioUpdates }, context) => {
    if (ideaUpdates.length === 0 && scenarioUpdates.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'At least one review update is required'
      })
    }

    const ideaIds = new Set<string>()
    ideaUpdates.forEach(({ ideaId }, index) => {
      if (ideaIds.has(ideaId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate feedback update: ${ideaId}`,
          path: ['ideaUpdates', index, 'ideaId']
        })
      }
      ideaIds.add(ideaId)
    })

    const scenarioSlugs = new Set<string>()
    scenarioUpdates.forEach(({ scenarioSlug }, index) => {
      if (scenarioSlugs.has(scenarioSlug)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate scenario update: ${scenarioSlug}`,
          path: ['scenarioUpdates', index, 'scenarioSlug']
        })
      }
      scenarioSlugs.add(scenarioSlug)
    })
  })

export const memeFeedbackBatchPatchSchema = z
  .object({
    updates: z.array(memeFeedbackPatchSchema).min(1).max(1000)
  })
  .superRefine(({ updates }, context) => {
    const ideaIds = new Set<string>()

    updates.forEach(({ ideaId }, index) => {
      if (ideaIds.has(ideaId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate feedback update: ${ideaId}`,
          path: ['updates', index, 'ideaId']
        })
      }
      ideaIds.add(ideaId)
    })
  })

// Round-one aliases keep the original assembly tooling and archive tests stable.
export const memePreviewLayoutSchema = memePreviewLayoutV1Schema
export const memeCritiqueSchema = memeCritiqueV1Schema
export const memeIdeaSchema = memeIdeaV1Schema
export const scenarioMemeIdeasSchema = scenarioMemeIdeasV1Schema
export const memeIdeaCollectionSchema = memeIdeaCollectionV1Schema
export const memeFeedbackDocumentSchema = memeFeedbackDocumentV1Schema

export type MemeIdeaV1 = z.infer<typeof memeIdeaV1Schema>
export type MemeIdeaV2 = z.infer<typeof memeIdeaV2Schema>
export type MemeIdea = MemeIdeaV2
export type ScenarioMemeIdeasV1 = z.infer<typeof scenarioMemeIdeasV1Schema>
export type ScenarioMemeIdeasV2 = z.infer<typeof scenarioMemeIdeasV2Schema>
export type ScenarioMemeIdeas = ScenarioMemeIdeasV2
export type MemeReviewAsset = z.infer<typeof memeReviewAssetSchema>
export type MemeReviewScenarioPreviewV1 = z.infer<
  typeof memeReviewScenarioPreviewV1Schema
>
export type MemeReviewScenarioPreviewDocumentV1 = z.infer<
  typeof memeReviewScenarioPreviewDocumentV1Schema
>
export type MemeRating = z.infer<typeof memeRatingSchema>
export type MemeFeedbackEntry = z.infer<typeof memeFeedbackEntrySchema>
export type MemeFeedbackDocumentV1 = z.infer<
  typeof memeFeedbackDocumentV1Schema
>
export type MemeReviewStateDocument = z.infer<
  typeof memeReviewStateDocumentSchema
>
export type MemeFeedbackDocument = MemeReviewStateDocument
export type ActiveMemeReviewRound = z.infer<typeof activeMemeReviewRoundSchema>
export type MemeReviewBatchStatus = z.infer<typeof memeReviewBatchStatusSchema>
export type MemeReviewScenarioState = z.infer<
  typeof memeReviewScenarioStateSchema
>
export type MemeFeedbackPatch = z.infer<typeof memeFeedbackPatchSchema>
export type MemeScenarioPatch = z.infer<typeof memeScenarioPatchSchema>
export type MemeReviewBatchPatch = z.infer<typeof memeReviewBatchPatchSchema>

function requireLikeWhenLocked(
  entry: {
    readonly rating: z.infer<typeof memeRatingSchema> | null
    readonly locked?: boolean
  },
  context: z.RefinementCtx
) {
  if (entry.locked === true && entry.rating !== 'like') {
    context.addIssue({
      code: 'custom',
      message: 'Only liked meme ideas can be finalized',
      path: ['locked']
    })
  }
}

function requireValidPersistedFinalization(
  entry: {
    readonly rating: z.infer<typeof memeRatingSchema> | null
    readonly locked: boolean
    readonly finalizedVersion?: z.infer<typeof memeFinalizedVersionSchema>
  },
  context: z.RefinementCtx
) {
  requireLikeWhenLocked(entry, context)

  if (!entry.locked && entry.finalizedVersion !== undefined) {
    context.addIssue({
      code: 'custom',
      message: 'Only locked meme ideas may retain a finalized version',
      path: ['finalizedVersion']
    })
  }
}
