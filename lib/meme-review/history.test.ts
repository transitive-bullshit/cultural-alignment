import { describe, expect, it } from 'vitest'

import type {
  MemeFeedbackDocumentV1,
  MemeIdeaV1,
  MemeIdeaV2,
  ScenarioMemeIdeasV1,
  ScenarioMemeIdeasV2
} from './schema'
import {
  buildMemePreviewHistory,
  type MemeArchivedReviewImage
} from './history'

describe('meme preview history', () => {
  it('retains every prior version of a lineage that remains active', () => {
    const archivedIdeas = [
      scenario('sample', [ideaV1('sample--01'), ideaV1('sample--02')])
    ]
    const activeIdeas = [scenarioV2('sample', [ideaV2('sample--01')])]
    const archivedFeedback: MemeFeedbackDocumentV1 = {
      version: 1,
      updatedAt: '2026-09-03T18:31:03.192Z',
      feedback: {
        'sample--01': {
          rating: 'like',
          notes: 'Survived',
          locked: false,
          lockRevision: 0
        },
        'sample--02': {
          rating: 'like',
          notes: 'Removed',
          locked: false,
          lockRevision: 0
        },
        'sample--03': {
          rating: 'dislike',
          notes: 'Never show this',
          locked: false,
          lockRevision: 0
        }
      }
    }
    const image = createImage()

    const history = buildMemePreviewHistory({
      activeIdeas,
      historySnapshots: [
        {
          kind: 'batch',
          renderer: 1,
          number: 1,
          name: 'round-01',
          revisionKey: 'round-01',
          label: 'Batch 1',
          path: '/example/round-01',
          ideas: archivedIdeas,
          feedback: archivedFeedback,
          previews: {
            version: 1,
            round: 1,
            scenarios: [
              {
                scenario_slug: 'sample',
                src: image.src,
                alt: image.alt,
                width: image.width,
                height: image.height,
                blur_data_url: image.blurDataURL,
                object_position: image.objectPosition,
                content_hash:
                  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
              }
            ]
          }
        }
      ]
    })

    expect(Object.keys(history)).toEqual(['sample--01'])
    expect(history['sample--01']).toEqual([
      {
        renderer: 1,
        batch: 1,
        revisionKey: 'round-01',
        label: 'Batch 1',
        idea: archivedIdeas[0]!.ideas[0],
        image,
        feedback: {
          rating: 'like',
          notes: 'Survived',
          locked: false,
          lockRevision: 0
        }
      }
    ])
  })
})

function scenario(
  scenario_slug: string,
  ideas: MemeIdeaV1[]
): ScenarioMemeIdeasV1 {
  return { scenario_slug, ideas }
}

function scenarioV2(
  scenario_slug: string,
  ideas: MemeIdeaV2[]
): ScenarioMemeIdeasV2 {
  return { scenario_slug, ideas }
}

function ideaV1(id: string): MemeIdeaV1 {
  return {
    id,
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact prop',
    caption_lines: ['The caption'],
    format: 'relabel',
    frame_guidance: 'Keep the prop visible.',
    why_it_works: 'One hinge carries the mapping.',
    preview: {
      layout: 'label',
      image: 'curated',
      alternate_image_query: null
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'Likely like.',
      strongest_quality: 'Exact hinge.',
      main_risk: 'Too terse.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      }
    }
  }
}

function ideaV2(id: string): MemeIdeaV2 {
  return {
    ...ideaV1(id),
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
      ...ideaV1(id).critic,
      scores: {
        scene_hinge: 5,
        ai_payoff: 5,
        parsing_ease: 5,
        visual_proof: 5,
        source_accuracy: 5
      },
      calibration: {
        closest_liked_id: id,
        contrast_disliked_id: null
      }
    }
  }
}

function createImage(): MemeArchivedReviewImage {
  return {
    src: 'https://assets.example.com/frame.webp',
    alt: 'Archived frame',
    width: 1920,
    height: 1080,
    blurDataURL: 'data:image/webp;base64,AA==',
    objectPosition: '50% 50%',
    contentHash:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  }
}
