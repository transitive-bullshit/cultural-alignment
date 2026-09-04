import { describe, expect, it } from 'vitest'

import {
  memeIdeaCollectionV2Schema,
  memeFeedbackBatchPatchSchema,
  memeIdeaCollectionSchema,
  memeReviewBatchPatchSchema,
  memeReviewStateDocumentSchema
} from './schema'

describe('meme review schemas', () => {
  const payloadFingerprint = 'v1-0000000000000000-1'
  const targetRevisionKey = 'round-01'

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

  it('rejects survivors that fail any part of the glance test', () => {
    const ideas = [1, 2, 3].map((index) => createIdea(index))
    ideas[1]!.critic.glance_test.meme = false

    const result = memeIdeaCollectionSchema.safeParse([
      { scenario_slug: 'sample-scenario', ideas }
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

  it('validates every V2 caption line has one composition slot', () => {
    const idea = createV2Idea()

    expect(
      memeIdeaCollectionV2Schema.safeParse([
        {
          scenario_slug: 'sample-scenario',
          ideas: [idea, createV2Idea(2), createV2Idea(3)]
        }
      ]).success
    ).toBe(true)

    idea.preview.zones[0]!.lines.push(1)
    expect(
      memeIdeaCollectionV2Schema.safeParse([
        {
          scenario_slug: 'sample-scenario',
          ideas: [idea, createV2Idea(2), createV2Idea(3)]
        }
      ]).success
    ).toBe(false)
  })

  it('accepts an explicit wide caption zone for a reviewed layout revision', () => {
    const sourceIdea = createV2Idea()
    const idea = {
      ...sourceIdea,
      preview: {
        ...sourceIdea.preview,
        zones: sourceIdea.preview.zones.map((zone, index) =>
          index === 0 ? { ...zone, width: 'wide' as const } : zone
        )
      }
    }

    expect(
      memeIdeaCollectionV2Schema.safeParse([
        { scenario_slug: 'sample-scenario', ideas: [idea] }
      ]).success
    ).toBe(true)
  })

  it('allows each active scenario to carry a batch-specific idea count', () => {
    for (const count of [1, 7]) {
      expect(
        memeIdeaCollectionV2Schema.safeParse([
          {
            scenario_slug: 'sample-scenario',
            ideas: Array.from({ length: count }, (_, index) =>
              createV2Idea(index + 1)
            )
          }
        ]).success
      ).toBe(true)
    }
  })

  it('accepts any positive batch number as a stale-write token', () => {
    const validPatch = {
      round: 2,
      ideaUpdates: [
        {
          ideaId: 'sample-scenario--01',
          feedback: { rating: 'like', notes: '' }
        }
      ]
    }

    expect(memeReviewBatchPatchSchema.safeParse(validPatch).success).toBe(true)
    expect(
      memeReviewBatchPatchSchema.safeParse({ ...validPatch, round: 7 }).success
    ).toBe(true)
    expect(
      memeReviewBatchPatchSchema.safeParse({ ...validPatch, round: 0 }).success
    ).toBe(false)
  })

  it('normalizes legacy review entries to an unlocked state', () => {
    const document = memeReviewStateDocumentSchema.parse({
      version: 2,
      round: 2,
      updatedAt: null,
      feedback: {
        'sample-scenario--01': { rating: 'like', notes: 'Legacy review.' }
      },
      scenarios: {}
    })

    expect(document.feedback['sample-scenario--01']).toEqual({
      rating: 'like',
      notes: 'Legacy review.',
      locked: false,
      lockRevision: 0
    })
  })

  it('only allows liked meme ideas to be finalized', () => {
    const patch = {
      round: 2,
      ideaUpdates: [
        {
          ideaId: 'sample-scenario--01',
          feedback: { rating: 'neutral', notes: '', locked: true },
          expectedFeedback: {
            rating: null,
            notes: '',
            locked: false,
            lockRevision: 0
          },
          targetRevisionKey,
          expectedPayloadFingerprint: payloadFingerprint
        }
      ]
    }

    expect(memeReviewBatchPatchSchema.safeParse(patch).success).toBe(false)
    expect(
      memeReviewBatchPatchSchema.safeParse({
        ...patch,
        ideaUpdates: [
          {
            ...patch.ideaUpdates[0],
            feedback: { rating: 'like', notes: '', locked: true }
          }
        ]
      }).success
    ).toBe(true)

    expect(
      memeReviewBatchPatchSchema.safeParse({
        round: 2,
        ideaUpdates: [
          {
            ideaId: 'sample-scenario--01',
            feedback: { rating: 'like', notes: '', locked: true }
          }
        ]
      }).success
    ).toBe(false)

    expect(
      memeReviewBatchPatchSchema.safeParse({
        ...patch,
        ideaUpdates: [
          {
            ...patch.ideaUpdates[0],
            feedback: { rating: 'like', notes: '', locked: true },
            targetRevisionKey: undefined
          }
        ]
      }).success
    ).toBe(false)

    expect(
      memeReviewBatchPatchSchema.safeParse({
        ...patch,
        ideaUpdates: [
          {
            ...patch.ideaUpdates[0],
            feedback: { rating: 'like', notes: '', locked: true },
            expectedPayloadFingerprint: undefined
          }
        ]
      }).success
    ).toBe(false)

    expect(
      memeReviewBatchPatchSchema.safeParse({
        round: 2,
        ideaUpdates: [
          {
            ideaId: 'sample-scenario--01',
            feedback: { rating: 'like', notes: '' },
            targetRevisionKey,
            expectedPayloadFingerprint: payloadFingerprint
          }
        ]
      }).success
    ).toBe(false)
  })

  it('stores finalized revision metadata only on locked feedback', () => {
    const finalizedVersion = {
      revisionKey: targetRevisionKey,
      payloadFingerprint
    }
    const document = {
      version: 2,
      round: 2,
      updatedAt: null,
      feedback: {
        'sample-scenario--01': {
          rating: 'like',
          notes: '',
          locked: true,
          lockRevision: 1,
          finalizedVersion
        }
      },
      scenarios: {}
    }

    expect(memeReviewStateDocumentSchema.safeParse(document).success).toBe(true)
    expect(
      memeReviewStateDocumentSchema.safeParse({
        ...document,
        feedback: {
          'sample-scenario--01': {
            ...document.feedback['sample-scenario--01'],
            locked: false
          }
        }
      }).success
    ).toBe(false)
    expect(
      memeReviewStateDocumentSchema.safeParse({
        ...document,
        feedback: {
          'sample-scenario--01': {
            rating: 'like',
            notes: '',
            locked: true,
            lockRevision: 1
          }
        }
      }).success
    ).toBe(true)
  })

  it('stores only disabled scenarios in sparse batch state', () => {
    const document = {
      version: 2,
      round: 2,
      updatedAt: null,
      feedback: {},
      scenarios: {
        'sample-scenario': { disabled: true }
      }
    }

    expect(memeReviewStateDocumentSchema.safeParse(document).success).toBe(true)
    expect(
      memeReviewStateDocumentSchema.safeParse({
        ...document,
        scenarios: { 'sample-scenario': { disabled: false } }
      }).success
    ).toBe(false)
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

function createV2Idea(index = 1, slug = 'sample-scenario') {
  return {
    ...createIdea(index, slug),
    caption_lines: ['if (looksAligned) {', 'deploy()', '}'],
    preview: {
      renderer: 2 as const,
      template: 'interface' as const,
      frame_mode: 'contain-black' as const,
      asset_ids: [`${slug}--curated`],
      zones: [
        {
          lines: [0, 1, 2],
          slot: 'full' as const,
          style: 'code' as const,
          align: 'left' as const,
          casing: 'preserve' as const,
          size: 'compact' as const,
          indent_levels: [0, 1, 0]
        }
      ]
    },
    critic: {
      ...createIdea(index, slug).critic,
      scores: {
        scene_hinge: 5,
        ai_payoff: 4,
        parsing_ease: 4,
        visual_proof: 5,
        source_accuracy: 5
      },
      calibration: {
        closest_liked_id: null,
        contrast_disliked_id: null
      }
    }
  }
}
