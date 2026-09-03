import { z } from 'zod'

export const memeFormatSchema = z.enum([
  'canon',
  'relabel',
  'collision',
  'dialogue',
  'state contrast',
  'source-native interface'
])

export const memePreviewLayoutSchema = z.enum([
  'top',
  'bottom',
  'top-bottom',
  'dialogue',
  'split',
  'label',
  'interface'
])

export const memeCritiqueSchema = z.object({
  verdict: z.enum(['keep', 'revise']),
  predicted_rating: z.enum(['dislike', 'neutral', 'like']),
  confidence: z.number().min(0).max(1),
  expected_feedback: z.string().trim().min(1),
  strongest_quality: z.string().trim().min(1),
  main_risk: z.string().trim().min(1),
  glance_test: z.object({
    source: z.boolean(),
    analogy: z.boolean(),
    meme: z.boolean(),
    visual: z.boolean()
  })
})

export const memeIdeaSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--\d{2}$/),
    ai_concept: z.string().trim().min(1),
    display_context: z.literal('standalone'),
    source_anchor: z.string().trim().min(1),
    caption_lines: z.array(z.string().trim().min(1)).min(1).max(4),
    format: memeFormatSchema,
    frame_guidance: z.string().trim().min(1),
    why_it_works: z.string().trim().min(1),
    preview: z.object({
      layout: memePreviewLayoutSchema,
      image: z.enum(['curated', 'alternate-needed']),
      alternate_image_query: z.string().trim().min(1).nullable()
    }),
    critic: memeCritiqueSchema
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

export const scenarioMemeIdeasSchema = z
  .object({
    scenario_slug: z.string().trim().min(1),
    ideas: z.array(memeIdeaSchema).min(3).max(5)
  })
  .superRefine(({ scenario_slug, ideas }, context) => {
    for (const idea of ideas) {
      if (!idea.id.startsWith(`${scenario_slug}--`)) {
        context.addIssue({
          code: 'custom',
          message: `Idea ${idea.id} must begin with its scenario slug`,
          path: ['ideas']
        })
      }
    }
  })

export const memeIdeaCollectionSchema = z
  .array(scenarioMemeIdeasSchema)
  .superRefine((scenarios, context) => {
    const scenarioSlugs = new Set<string>()
    const ideaIds = new Set<string>()

    scenarios.forEach((scenario, scenarioIndex) => {
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

export const memeRatingSchema = z.enum(['dislike', 'neutral', 'like'])

export const memeFeedbackEntrySchema = z.object({
  rating: memeRatingSchema.nullable(),
  notes: z.string().max(4000)
})

export const memeFeedbackDocumentSchema = z.object({
  version: z.literal(1),
  updatedAt: z.iso.datetime().nullable(),
  feedback: z.record(z.string(), memeFeedbackEntrySchema)
})

export const memeFeedbackPatchSchema = z.object({
  ideaId: z.string().trim().min(1),
  feedback: memeFeedbackEntrySchema
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

export type MemeIdea = z.infer<typeof memeIdeaSchema>
export type ScenarioMemeIdeas = z.infer<typeof scenarioMemeIdeasSchema>
export type MemeRating = z.infer<typeof memeRatingSchema>
export type MemeFeedbackEntry = z.infer<typeof memeFeedbackEntrySchema>
export type MemeFeedbackDocument = z.infer<typeof memeFeedbackDocumentSchema>
export type MemeFeedbackPatch = z.infer<typeof memeFeedbackPatchSchema>
