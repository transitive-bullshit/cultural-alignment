import { describe, expect, it } from 'vitest'

import { memeRevisionFingerprint } from './fingerprint'
import { resolveFinalizedMemeRenderTargets } from './finalized-renders'
import type { MemePreviewHistory } from './history'
import type { MemeReviewSource } from './catalog'
import type {
  MemeFeedbackEntry,
  MemeIdeaV1,
  MemeIdeaV2,
  MemeReviewAsset
} from './schema'

describe('resolveFinalizedMemeRenderTargets', () => {
  it('renders the selected historical payload while normalizing only terminal periods', () => {
    const activeIdea = createV2Idea('Current draft.')
    const historicalIdea = createV1Idea('“SHIP IT.”', 'MONSTERS, INC.')
    const image = {
      src: 'https://example.com/frame.jpg',
      alt: 'The exact scene',
      width: 1280,
      height: 720,
      blurDataURL: 'data:image/jpeg;base64,AA==',
      objectPosition: '50% 50%',
      contentHash: 'b'.repeat(64)
    }
    const payloadFingerprint = memeRevisionFingerprint({
      renderer: 1,
      idea: historicalIdea,
      image
    })
    const historyByIdeaId: MemePreviewHistory = {
      [activeIdea.id]: [
        {
          renderer: 1,
          batch: 1,
          revisionKey: 'round-01',
          label: 'Batch 1',
          idea: historicalIdea,
          image,
          feedback: emptyFeedback
        }
      ]
    }

    const [target] = resolveFinalizedMemeRenderTargets({
      sources: createSources(activeIdea),
      historyByIdeaId,
      feedback: {
        [activeIdea.id]: {
          rating: 'like',
          notes: '',
          locked: true,
          lockRevision: 1,
          finalizedVersion: {
            revisionKey: 'round-01',
            payloadFingerprint
          }
        }
      },
      activeRevisionKey: 'round-05',
      activeRevisionLabel: 'Batch 5'
    })

    expect(target?.renderer).toBe(1)
    expect(target?.idea.caption_lines).toEqual(['“SHIP IT”', 'MONSTERS, INC.'])
    expect(target?.payloadFingerprint).toBe(payloadFingerprint)
    expect(target?.renderedPayloadFingerprint).not.toBe(payloadFingerprint)
    expect(target?.terminalPeriodNormalization).toEqual({
      applied: true,
      changedLineIndexes: [0]
    })
  })

  it('uses the active payload for a current finalization', () => {
    const activeIdea = createV2Idea('SHIP IT.')
    const asset = createAsset()
    const payloadFingerprint = memeRevisionFingerprint({
      renderer: 2,
      idea: activeIdea,
      assets: [asset]
    })

    const [target] = resolveFinalizedMemeRenderTargets({
      sources: createSources(activeIdea),
      historyByIdeaId: {},
      feedback: {
        [activeIdea.id]: {
          rating: 'like',
          notes: '',
          locked: true,
          lockRevision: 1,
          finalizedVersion: {
            revisionKey: 'round-05',
            payloadFingerprint
          }
        }
      },
      activeRevisionKey: 'round-05',
      activeRevisionLabel: 'Batch 5'
    })

    expect(target?.renderer).toBe(2)
    expect(target?.idea.caption_lines).toEqual(['SHIP IT'])
    expect(target?.revisionLabel).toBe('Batch 5')
  })

  it('refuses an unavailable or fingerprint-mismatched finalized revision', () => {
    const activeIdea = createV2Idea('SHIP IT.')
    const sources = createSources(activeIdea)

    expect(() =>
      resolveFinalizedMemeRenderTargets({
        sources,
        historyByIdeaId: {},
        feedback: {
          [activeIdea.id]: {
            rating: 'like',
            notes: '',
            locked: true,
            lockRevision: 1,
            finalizedVersion: {
              revisionKey: 'round-01',
              payloadFingerprint: 'v1-aaaaaaaaaaaaaaaa-1'
            }
          }
        },
        activeRevisionKey: 'round-05',
        activeRevisionLabel: 'Batch 5'
      })
    ).toThrow('references unavailable revision round-01')

    expect(() =>
      resolveFinalizedMemeRenderTargets({
        sources,
        historyByIdeaId: {},
        feedback: {
          [activeIdea.id]: {
            rating: 'like',
            notes: '',
            locked: true,
            lockRevision: 1,
            finalizedVersion: {
              revisionKey: 'round-05',
              payloadFingerprint: 'v1-aaaaaaaaaaaaaaaa-1'
            }
          }
        },
        activeRevisionKey: 'round-05',
        activeRevisionLabel: 'Batch 5'
      })
    ).toThrow('payload no longer matches round-05')
  })
})

const emptyFeedback: MemeFeedbackEntry = {
  rating: null,
  notes: '',
  locked: false,
  lockRevision: 0
}

function createSources(idea: MemeIdeaV2): readonly MemeReviewSource[] {
  const asset = createAsset()

  return [
    {
      slug: 'sample-source',
      title: 'Sample Source',
      scenarios: [
        {
          slug: 'sample',
          title: 'Sample Scenario',
          href: '/scenarios/sample',
          featured: true,
          episodeLabel: null,
          source: { slug: 'sample-source', title: 'Sample Source' },
          image: {
            src: asset.src,
            alt: asset.alt,
            width: asset.width,
            height: asset.height,
            blurDataURL: asset.blur_data_url,
            objectPosition: '50% 50%'
          },
          assets: [asset],
          ideas: [idea]
        }
      ]
    }
  ]
}

function createV1Idea(...captionLines: string[]): MemeIdeaV1 {
  return {
    id: 'sample--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact scene',
    caption_lines: captionLines,
    format: 'relabel',
    frame_guidance: 'Keep the scene visible.',
    why_it_works: 'The scene carries both sides.',
    preview: {
      layout: 'top-bottom',
      image: 'curated',
      alternate_image_query: null
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'It lands.',
      strongest_quality: 'Exact hinge.',
      main_risk: 'None.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      }
    }
  }
}

function createV2Idea(caption: string): MemeIdeaV2 {
  return {
    id: 'sample--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact scene',
    caption_lines: [caption],
    format: 'relabel',
    frame_guidance: 'Keep the scene visible.',
    why_it_works: 'The scene carries both sides.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'cover',
      asset_ids: ['sample--curated'],
      zones: [
        {
          lines: [0],
          slot: 'top',
          style: 'impact',
          align: 'center',
          casing: 'uppercase',
          size: 'hero',
          indent_levels: [0]
        }
      ]
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'It lands.',
      strongest_quality: 'Exact hinge.',
      main_risk: 'None.',
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

function createAsset(): MemeReviewAsset {
  return {
    id: 'sample--curated',
    scenario_slug: 'sample',
    src: 'https://example.com/frame.jpg',
    width: 1280,
    height: 720,
    alt: 'The exact scene',
    blur_data_url: 'data:image/jpeg;base64,AA==',
    content_hash: 'a'.repeat(64),
    protected_regions: []
  }
}
