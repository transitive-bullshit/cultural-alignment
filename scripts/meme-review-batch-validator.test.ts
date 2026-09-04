import { describe, expect, it } from 'vitest'

import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewStateDocumentSchema,
  type MemeFeedbackEntry,
  type MemeIdeaV2
} from '../lib/meme-review/schema'
import type {
  MemeReviewGenerationAction,
  MemeReviewGenerationPlan
} from './prepare-meme-review-batch'
import {
  memeReviewIdeaEditorialHash,
  memeReviewIdeaHash
} from './meme-review-round-utils'
import { validateMemeReviewBatch } from './meme-review-batch-validator'

describe('meme review batch validator', () => {
  it('accepts the layout-policy boundaries', () => {
    const ideas = Array.from({ length: 10 }, (_, index) => {
      const idea = createIdea(index + 1)
      if (index < 6) return idea
      if (index < 8) return compactIdea(idea)
      if (index === 8) return externalIdea(idea)
      return nonCoverIdea(idea)
    })
    const fixture = createFixture({ ideas })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual([])
    expect(report.metrics.strict_traditional.ratio).toBe(0.6)
    expect(report.metrics.external_layouts.ratio).toBe(0.1)
    expect(report.metrics.non_cover_frames.ratio).toBe(0.1)
  })

  it('reports layout policy regressions', () => {
    const ideas = Array.from({ length: 10 }, (_, index) =>
      index < 5 ? createIdea(index + 1) : compactIdea(createIdea(index + 1))
    )
    const fixture = createFixture({ ideas })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Strict traditional layouts'),
        expect.stringContaining('Readable ordinary caption zones'),
        expect.stringContaining('Compact ordinary caption zones')
      ])
    )
  })

  it('uses pass-neutral ratios for empty minimum and maximum scopes', () => {
    const idea = {
      ...createIdea(1),
      format: 'dialogue' as const
    }
    const fixture = createFixture({ ideas: [idea] })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual([])
    expect(report.metrics.strict_traditional).toMatchObject({
      total: 0,
      ratio: 1
    })
    expect(report.metrics.readable_ordinary_zones).toMatchObject({
      total: 0,
      ratio: 1
    })
    expect(report.metrics.compact_ordinary_zones).toMatchObject({
      total: 0,
      ratio: 0
    })
  })

  it('allows only plan-authorized editorial changes', () => {
    const sourceIdea = createIdea(1)
    const targetIdea = {
      ...sourceIdea,
      caption_lines: ['CHANGED SETUP', sourceIdea.caption_lines[1]!]
    }
    const feedback = createFeedback('like', 'Use this replacement copy')
    const layoutOnly = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      permissivePolicy: true
    })

    expect(validateMemeReviewBatch(layoutOnly).issues).toContain(
      `${sourceIdea.id} changed unauthorized field caption_lines for layout-only`
    )

    const boundedRevision = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'bounded-revision' },
      permissivePolicy: true
    })
    expect(validateMemeReviewBatch(boundedRevision).issues).toEqual([])
  })

  it('accepts only the deterministic terminal-period transform for punctuation-only ideas', () => {
    const sourceIdea = {
      ...createIdea(1),
      caption_lines: ['MODEL VERSION 1.2...', '“SHIP IT.”']
    }
    const targetIdea = {
      ...sourceIdea,
      caption_lines: ['MODEL VERSION 1.2...', '“SHIP IT”']
    }
    const feedback = createFeedback('like', 'remove the periods')
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'punctuation-only' },
      mode: 'punctuation-refinement'
    })

    expect(validateMemeReviewBatch(fixture).issues).toEqual([])

    const arbitraryCopy = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [
        { ...sourceIdea, caption_lines: ['MODEL VERSION 1.2...', 'SHIP IT'] }
      ],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'punctuation-only' },
      mode: 'punctuation-refinement'
    })
    expect(validateMemeReviewBatch(arbitraryCopy).issues).toContain(
      `${sourceIdea.id} made a non-canonical punctuation-only caption change`
    )
  })

  it('keeps punctuation-only ideas out of layout metrics and rejects preview changes', () => {
    const sourceIdea = compactIdea(createIdea(1))
    sourceIdea.caption_lines = ['SETUP.', 'PAYOFF.']
    const targetIdea = {
      ...sourceIdea,
      caption_lines: ['SETUP', 'PAYOFF']
    }
    const feedback = createFeedback('like', 'remove the periods')
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'punctuation-only' },
      mode: 'punctuation-refinement'
    })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual([])
    expect(report.metrics.readable_ordinary_zones.total).toBe(0)

    const changedPreview = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [
        {
          ...targetIdea,
          preview: { ...targetIdea.preview, frame_mode: 'contain-black' }
        }
      ],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'punctuation-only' },
      mode: 'punctuation-refinement'
    })
    expect(validateMemeReviewBatch(changedPreview).issues).toContain(
      `${sourceIdea.id} changed unauthorized field preview for punctuation-only`
    )
  })

  it('requires completed bounded punctuation revisions to remove terminal periods', () => {
    const sourceIdea = createIdea(1)
    sourceIdea.caption_lines = ['SETUP.', 'PAYOFF.']
    const feedback = createFeedback(
      'like',
      'remove the periods and make the setup wider'
    )
    const fixture = createFixture({
      ideas: [sourceIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'bounded-revision' },
      mode: 'punctuation-refinement',
      permissivePolicy: true
    })

    expect(validateMemeReviewBatch(fixture).issues).toContain(
      `${sourceIdea.id} bounded punctuation revision still has terminal periods`
    )
  })

  it('rejects new lineage IDs', () => {
    const sourceIdea = createIdea(1)
    const targetIdea = { ...sourceIdea, id: 'scenario--99' }
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      permissivePolicy: true
    })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Target introduced unplanned idea'),
        expect.stringContaining('Target dropped retained idea')
      ])
    )
  })

  it('rejects changes to finalized ideas', () => {
    const sourceIdea = createIdea(1)
    const targetIdea = {
      ...sourceIdea,
      frame_guidance: 'Changed finalized guidance'
    }
    const feedback = createFeedback('like', '', true)
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      feedbackById: { [sourceIdea.id]: feedback },
      actions: { [sourceIdea.id]: 'finalized' },
      permissivePolicy: true
    })
    const report = validateMemeReviewBatch(fixture)

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('changed unauthorized field frame_guidance'),
        expect.stringContaining('changed its finalized idea payload')
      ])
    )
  })

  it('requires left and right caption panels for a diptych', () => {
    const sourceIdea = {
      ...createIdea(1),
      format: 'state contrast' as const
    }
    const targetIdea = {
      ...sourceIdea,
      preview: {
        ...sourceIdea.preview,
        template: 'diptych' as const,
        asset_ids: ['scenario--curated', 'scenario--alternate'],
        zones: [createZone([0], 'top'), createZone([1], 'bottom')]
      }
    }
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      targetAssets: [
        createAsset('scenario--curated'),
        createAsset('scenario--alternate')
      ],
      permissivePolicy: true
    })

    expect(validateMemeReviewBatch(fixture).issues).toContain(
      `${sourceIdea.id} diptych must use exactly one panel-left and one panel-right caption zone`
    )
  })

  it('requires explicit plan authorization for a new asset', () => {
    const sourceIdea = createIdea(1)
    const targetIdea = {
      ...sourceIdea,
      preview: {
        ...sourceIdea.preview,
        asset_ids: ['scenario--alternate']
      }
    }
    const fixture = createFixture({
      ideas: [sourceIdea],
      targetIdeas: [targetIdea],
      targetAssets: [createAsset('scenario--alternate')],
      permissivePolicy: true
    })
    const plan = { ...fixture.plan, asset_revision_idea_ids: [] }

    expect(validateMemeReviewBatch({ ...fixture, plan }).issues).toContain(
      `${sourceIdea.id} references new asset scenario--alternate without asset authorization`
    )
  })
})

function createFixture({
  ideas,
  targetIdeas = ideas,
  targetAssets = [createAsset('scenario--curated')],
  feedbackById,
  actions = {},
  mode = 'layout-refinement',
  permissivePolicy = false
}: {
  readonly ideas: readonly MemeIdeaV2[]
  readonly targetIdeas?: readonly MemeIdeaV2[]
  readonly targetAssets?: ReturnType<typeof createAsset>[]
  readonly feedbackById?: Readonly<Record<string, MemeFeedbackEntry>>
  readonly actions?: Readonly<Record<string, MemeReviewGenerationAction>>
  readonly mode?: MemeReviewGenerationPlan['mode']
  readonly permissivePolicy?: boolean
}) {
  const sourceIdeas = memeIdeaCollectionV2Schema.parse([
    { scenario_slug: 'scenario', ideas }
  ])
  const parsedTargetIdeas = memeIdeaCollectionV2Schema.parse([
    { scenario_slug: 'scenario', ideas: targetIdeas }
  ])
  const sourceAssets = memeReviewAssetCollectionSchema.parse([
    createAsset('scenario--curated')
  ])
  const parsedTargetAssets = memeReviewAssetCollectionSchema.parse(targetAssets)
  const resolvedFeedback = Object.fromEntries(
    ideas.map((idea) => [
      idea.id,
      feedbackById?.[idea.id] ?? createFeedback('like')
    ])
  )
  const sourceFeedback = memeReviewStateDocumentSchema.parse({
    version: 2,
    round: 2,
    updatedAt: null,
    feedback: resolvedFeedback,
    scenarios: {}
  })
  const targetFeedback = memeReviewStateDocumentSchema.parse({
    version: 2,
    round: 3,
    updatedAt: null,
    feedback: Object.fromEntries(
      Object.entries(resolvedFeedback).filter(([, feedback]) => feedback.locked)
    ),
    scenarios: {}
  })
  const planIdeas = ideas.map((idea) => {
    const action = actions[idea.id] ?? 'layout-only'
    return {
      id: idea.id,
      scenario_slug: 'scenario',
      action,
      source_idea_sha256: memeReviewIdeaHash(idea),
      source_editorial_sha256: memeReviewIdeaEditorialHash(idea),
      allowed_changed_fields:
        action === 'layout-only'
          ? (['preview', 'frame_guidance', 'critic', 'assets'] as const)
          : action === 'bounded-revision'
            ? ([
                'caption_lines',
                'preview',
                'frame_guidance',
                'why_it_works',
                'critic',
                'assets'
              ] as const)
            : action === 'punctuation-only'
              ? (['caption_lines'] as const)
              : [],
      source_feedback: resolvedFeedback[idea.id] ?? null
    }
  })
  const plan: MemeReviewGenerationPlan = {
    version: 1,
    mode,
    source_batch: 2,
    target_batch: 3,
    created_at: '2026-09-04T00:00:00.000Z',
    source_files: {
      'ideas.json': { bytes: 1, sha256: 'a' },
      'assets.json': { bytes: 1, sha256: 'a' },
      'feedback.json': { bytes: 1, sha256: 'a' },
      'status.json': { bytes: 1, sha256: 'a' }
    },
    counts: {
      source_scenarios: 1,
      source_ideas: ideas.length,
      target_scenarios: 1,
      target_ideas: ideas.length,
      mutable_scenarios: 1,
      mutable_ideas: planIdeas.filter(({ action }) =>
        ['layout-only', 'bounded-revision', 'punctuation-only'].includes(action)
      ).length,
      finalized_ideas: planIdeas.filter(({ action }) => action === 'finalized')
        .length,
      disabled_scenarios: 0,
      dropped_scenarios: 0,
      dropped_ideas: 0
    },
    ideas: planIdeas,
    dropped_ideas: [],
    asset_revision_idea_ids: planIdeas.flatMap(
      ({ id, allowed_changed_fields }) =>
        (allowed_changed_fields as readonly string[]).includes('assets')
          ? [id]
          : []
    ),
    layout_policy: permissivePolicy
      ? {
          minimum_traditional_template_ratio: 0,
          minimum_cover_frame_ratio: 0,
          minimum_hero_or_standard_zone_ratio: 0,
          maximum_external_layout_ratio: 1,
          external_layout_exception_ids: [],
          non_cover_exception_ids: [],
          compact_text_exception_ids: []
        }
      : {
          minimum_traditional_template_ratio: 0.6,
          minimum_cover_frame_ratio: 0.9,
          minimum_hero_or_standard_zone_ratio: 0.8,
          maximum_external_layout_ratio: 0.1,
          external_layout_exception_ids: [],
          non_cover_exception_ids: [],
          compact_text_exception_ids: []
        },
    parts: [
      {
        part: 'part-01',
        scenario_slugs: ['scenario'],
        idea_ids: ideas.map(({ id }) => id)
      }
    ]
  }

  return {
    sourceIdeas,
    sourceAssets,
    sourceFeedback,
    targetIdeas: parsedTargetIdeas,
    targetAssets: parsedTargetAssets,
    targetFeedback,
    plan
  }
}

function createIdea(number: number): MemeIdeaV2 {
  const id = `scenario--${String(number).padStart(2, '0')}`
  return {
    id,
    ai_concept: 'Test concept',
    display_context: 'standalone',
    source_anchor: 'A concrete source action',
    caption_lines: ['SETUP', 'PAYOFF'],
    format: 'collision',
    frame_guidance: 'Preserve the recognition hinge',
    why_it_works: 'The setup and payoff make one precise mapping.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'cover',
      asset_ids: ['scenario--curated'],
      zones: [createZone([0], 'top'), createZone([1], 'bottom')]
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.8,
      expected_feedback: 'Expected feedback',
      strongest_quality: 'Strong source hinge',
      main_risk: 'Narrow reference',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      },
      scores: {
        scene_hinge: 5,
        ai_payoff: 5,
        parsing_ease: 5,
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

function createZone(
  lines: number[],
  slot: MemeIdeaV2['preview']['zones'][number]['slot'],
  size: MemeIdeaV2['preview']['zones'][number]['size'] = 'standard'
) {
  return {
    lines,
    slot,
    style: 'impact' as const,
    align: 'center' as const,
    casing: 'preserve' as const,
    size,
    indent_levels: lines.map(() => 0)
  }
}

function compactIdea(idea: MemeIdeaV2): MemeIdeaV2 {
  return {
    ...idea,
    preview: {
      ...idea.preview,
      zones: [createZone([0, 1], 'top-left', 'compact')]
    }
  }
}

function externalIdea(idea: MemeIdeaV2): MemeIdeaV2 {
  return {
    ...idea,
    preview: {
      ...idea.preview,
      template: 'band-top',
      zones: [createZone([0, 1], 'top')]
    }
  }
}

function nonCoverIdea(idea: MemeIdeaV2): MemeIdeaV2 {
  return {
    ...idea,
    preview: {
      ...idea.preview,
      frame_mode: 'contain-black',
      zones: [createZone([0, 1], 'bottom')]
    }
  }
}

function createAsset(id: string) {
  return {
    id,
    scenario_slug: 'scenario',
    src: `https://example.com/${id}.webp`,
    width: 1280,
    height: 720,
    alt: 'Source still',
    blur_data_url: 'data:image/webp;base64,AAAA',
    content_hash: 'a'.repeat(64),
    protected_regions: [
      {
        id: `${id}--face`,
        label: 'Recognizable face',
        kind: 'face' as const,
        priority: 'must' as const,
        source_rect: [40, 20, 20, 30] as const
      }
    ]
  }
}

function createFeedback(
  rating: MemeFeedbackEntry['rating'],
  notes = '',
  locked = false
): MemeFeedbackEntry {
  return {
    rating,
    notes,
    locked,
    lockRevision: locked ? 1 : 0,
    ...(locked
      ? {
          finalizedVersion: {
            revisionKey: 'round-02',
            payloadFingerprint: 'v1-0000000000000000-1'
          }
        }
      : {})
  }
}
