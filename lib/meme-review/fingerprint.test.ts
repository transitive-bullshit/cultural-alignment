import { describe, expect, it } from 'vitest'

import type { MemeIdeaV1, MemeIdeaV2, MemeReviewAsset } from './schema'
import {
  memeFinalizationFingerprint,
  memeRevisionFingerprint,
  type MemeFinalizationImage
} from './fingerprint'

describe('meme finalization fingerprint', () => {
  it('changes with copy, layout, or a referenced asset record', () => {
    const idea = createIdea()
    const asset = createAsset()
    const original = memeFinalizationFingerprint(idea, [asset])

    expect(
      memeFinalizationFingerprint(
        { ...idea, caption_lines: ['Changed copy'] },
        [asset]
      )
    ).not.toBe(original)
    expect(
      memeFinalizationFingerprint(
        {
          ...idea,
          preview: { ...idea.preview, frame_mode: 'contain-black' }
        },
        [asset]
      )
    ).not.toBe(original)
    expect(
      memeFinalizationFingerprint(idea, [
        { ...asset, alt: 'A changed exact prop' }
      ])
    ).not.toBe(original)

    expect(
      memeRevisionFingerprint({ renderer: 2, idea, assets: [asset] })
    ).toBe(original)
  })

  it('binds renderer-v1 copy and the full archived image descriptor', () => {
    const idea = createV1Idea()
    const image = createImage()
    const original = memeRevisionFingerprint({ renderer: 1, idea, image })

    expect(
      memeRevisionFingerprint({
        renderer: 1,
        idea: { ...idea, caption_lines: ['Changed legacy copy'] },
        image
      })
    ).not.toBe(original)
    expect(
      memeRevisionFingerprint({
        renderer: 1,
        idea,
        image: { ...image, objectPosition: '40% 50%' }
      })
    ).not.toBe(original)
    expect(
      memeRevisionFingerprint({
        renderer: 1,
        idea,
        image: { ...image, contentHash: 'b'.repeat(64) }
      })
    ).not.toBe(original)
  })
})

function createV1Idea(): MemeIdeaV1 {
  return {
    id: 'sample--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact prop',
    caption_lines: ['One clean beat'],
    format: 'relabel',
    frame_guidance: 'Keep the prop visible.',
    why_it_works: 'The prop carries both sides.',
    preview: {
      layout: 'label',
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

function createIdea(): MemeIdeaV2 {
  return {
    id: 'sample--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact prop',
    caption_lines: ['One clean beat'],
    format: 'relabel',
    frame_guidance: 'Keep the prop visible.',
    why_it_works: 'The prop carries both sides.',
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
          size: 'standard',
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
    alt: 'The exact prop',
    blur_data_url: 'data:image/jpeg;base64,AA==',
    content_hash: 'a'.repeat(64),
    protected_regions: []
  }
}

function createImage(): MemeFinalizationImage {
  return {
    src: 'https://example.com/frame.jpg',
    width: 1280,
    height: 720,
    alt: 'The exact prop',
    blurDataURL: 'data:image/jpeg;base64,AA==',
    objectPosition: '50% 50%',
    contentHash: 'a'.repeat(64)
  }
}
