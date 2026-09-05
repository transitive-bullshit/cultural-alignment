import { describe, expect, it } from 'vitest'

import { semanticMemeIntentSchema } from './semantic-plan'

describe('semantic meme intent', () => {
  it('accepts semantic copy and placement without physical geometry', () => {
    const parsed = semanticMemeIntentSchema.parse({
      version: 2,
      fixture_id: 'fixture',
      recognition_hinge: { description: 'face', region_ids: ['face'] },
      ai_bridge: { concept: 'gaming', connection: 'teaching to the test' },
      caption_lines: [
        {
          text: 'WHEN THE BENCHMARK BECOMES THE CURRICULUM',
          kind: 'original',
          role: 'only',
          anchor_region_id: null,
          indent_level: 0
        }
      ],
      format: 'collision',
      presentation: {
        mode: 'single',
        source_frames: [{ image_id: 'frame', role: 'single' }],
        preferred_edge: 'auto',
        palette: 'default'
      },
      why_it_works: 'one collision'
    })

    expect(parsed.presentation).not.toHaveProperty('bounds_pct')
    expect(parsed.presentation).not.toHaveProperty('font_size_pct')
    expect(parsed.presentation).not.toHaveProperty('rendered_line_count')
  })

  it('rejects state contrast without two source frames', () => {
    const result = semanticMemeIntentSchema.safeParse({
      version: 2,
      fixture_id: 'fixture',
      recognition_hinge: { description: 'change', region_ids: [] },
      ai_bridge: { concept: 'drift', connection: 'before and after' },
      caption_lines: [
        {
          text: 'BEFORE',
          kind: 'original',
          role: 'setup',
          anchor_region_id: null,
          indent_level: 0
        },
        {
          text: 'AFTER',
          kind: 'original',
          role: 'payoff',
          anchor_region_id: null,
          indent_level: 0
        }
      ],
      format: 'state contrast',
      presentation: {
        mode: 'state-contrast',
        source_frames: [{ image_id: 'frame', role: 'before' }],
        preferred_edge: 'auto',
        palette: 'default'
      },
      why_it_works: 'contrast'
    })

    expect(result.success).toBe(false)
  })

  it('rejects state contrast with anything other than two caption beats', () => {
    const result = semanticMemeIntentSchema.safeParse({
      version: 2,
      fixture_id: 'fixture',
      recognition_hinge: { description: 'change', region_ids: [] },
      ai_bridge: { concept: 'drift', connection: 'before and after' },
      caption_lines: [
        {
          text: 'BEFORE',
          kind: 'original',
          role: 'setup',
          anchor_region_id: null,
          indent_level: 0
        },
        {
          text: 'DURING',
          kind: 'original',
          role: 'label',
          anchor_region_id: null,
          indent_level: 0
        },
        {
          text: 'AFTER',
          kind: 'original',
          role: 'payoff',
          anchor_region_id: null,
          indent_level: 0
        }
      ],
      format: 'state contrast',
      presentation: {
        mode: 'state-contrast',
        source_frames: [
          { image_id: 'before', role: 'before' },
          { image_id: 'after', role: 'after' }
        ],
        preferred_edge: 'auto',
        palette: 'default'
      },
      why_it_works: 'contrast'
    })

    expect(result.success).toBe(false)
  })

  it('rejects whitespace that the renderer would otherwise normalize', () => {
    const result = semanticMemeIntentSchema.safeParse({
      version: 2,
      fixture_id: 'fixture',
      recognition_hinge: { description: 'code', region_ids: [] },
      ai_bridge: { concept: 'control', connection: 'exact code' },
      caption_lines: [
        {
          text: 'ALLOW  ROOT\tNOW',
          kind: 'original',
          role: 'only',
          anchor_region_id: null,
          indent_level: 0
        }
      ],
      format: 'collision',
      presentation: {
        mode: 'single',
        source_frames: [{ image_id: 'frame', role: 'single' }],
        preferred_edge: 'auto',
        palette: 'default'
      },
      why_it_works: 'exact copy'
    })

    expect(result.success).toBe(false)
  })
})
