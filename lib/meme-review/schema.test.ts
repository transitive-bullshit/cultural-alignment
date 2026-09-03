import { describe, expect, it } from 'vitest'

import {
  memeFeedbackBatchPatchSchema,
  memeIdeaCollectionSchema
} from './schema'

describe('meme review schemas', () => {
  it('accepts three reviewed ideas with distinct stable ids', () => {
    const collection = memeIdeaCollectionSchema.parse([
      {
        scenario_slug: 'sample-scenario',
        ideas: [1, 2, 3].map((index) => createIdea(index))
      }
    ])

    expect(collection[0]?.ideas).toHaveLength(3)
    expect(new Set(collection[0]?.ideas.map(({ id }) => id)).size).toBe(3)
  })

  it('rejects duplicate idea ids and ids from another scenario', () => {
    const result = memeIdeaCollectionSchema.safeParse([
      {
        scenario_slug: 'sample-scenario',
        ideas: [createIdea(1), createIdea(1), createIdea(2, 'other-scenario')]
      }
    ])

    expect(result.success).toBe(false)
  })

  it('rejects duplicate entries in one autosave batch', () => {
    const feedback = { rating: 'like' as const, notes: '' }
    const result = memeFeedbackBatchPatchSchema.safeParse({
      updates: [
        { ideaId: 'sample-scenario--01', feedback },
        { ideaId: 'sample-scenario--01', feedback }
      ]
    })

    expect(result.success).toBe(false)
  })
})

function createIdea(index: number, slug = 'sample-scenario') {
  return {
    id: `${slug}--${String(index).padStart(2, '0')}`,
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'A visible canonical prop',
    caption_lines: ['One clean beat'],
    format: 'relabel',
    frame_guidance: 'Keep the canonical prop visible.',
    why_it_works: 'The prop carries the source and analogy at once.',
    preview: {
      layout: 'label',
      image: 'curated',
      alternate_image_query: null
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.75,
      expected_feedback: 'Specific enough to survive another pass.',
      strongest_quality: 'One clean recognition hinge.',
      main_risk: 'The wording may still be too literal.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      }
    }
  }
}
