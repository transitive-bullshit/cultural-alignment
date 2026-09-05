import { describe, expect, it } from 'vitest'

import {
  buildImpactComparisonHtml,
  buildStrokeWrapComparisonHtml
} from './impact-comparison-report'
import {
  buildArchiveComparisonManifest,
  type ArchiveComparisonCase,
  type ArchiveComparisonManifest
} from './selection'
import type { ArchiveV3RevisedResult, ArchiveV3RunManifest } from './v3-runner'
import type { MemeEvalPlan } from '../schema'

describe('V3 to V4 impact comparison report', () => {
  it('shows only objectively ready pairs by default and exposes a separate status filter', async () => {
    const cases = await firstArchiveCases(2)
    const v3 = manifestFor(cases, cases.map(completeCase))
    const v4 = manifestFor(cases, [
      completeCase(cases[0]!),
      invalidCase(cases[1]!)
    ])

    const html = await buildImpactComparisonHtml({
      v3Manifest: v3,
      v4Manifest: v4,
      expectedCaseCount: cases.length,
      readPreview: readTestPreview
    })

    expect(
      html.match(/<article class="case" data-comparison-row/g)
    ).toHaveLength(cases.length)
    expect(html.match(/data-version="v3"/g)).toHaveLength(cases.length)
    expect(html.match(/data-version="v4"/g)).toHaveLength(cases.length)
    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(1)
    expect(html.match(/data-pair-status="wip"[^>]* hidden/g)).toHaveLength(1)
    expect(html).toMatch(
      /<select id="status"[^>]*>[\s\S]*?<option value="ready" selected>/
    )
    expect(html).toContain('data-ready-count="1"')
    expect(html).toContain('data-wip-count="1"')
  })

  it('keeps a missing V4 result as a visibly pending WIP row', async () => {
    const cases = await firstArchiveCases(2)
    const v3 = manifestFor(cases, cases.map(completeCase))
    const v4Cases = cases.slice(0, 1)
    const v4 = manifestFor(v4Cases, v4Cases.map(completeCase))

    const html = await buildImpactComparisonHtml({
      v3Manifest: v3,
      v4Manifest: v4,
      expectedCaseCount: cases.length,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(1)
    expect(html.match(/data-pair-status="wip"[^>]* hidden/g)).toHaveLength(1)
    expect(html.match(/data-version="v4" data-state="pending"/g)).toHaveLength(
      1
    )
  })

  it('rejects a V4 manifest that substitutes an unrelated case identity', async () => {
    const cases = await firstArchiveCases(2)
    const v3 = manifestFor(cases, cases.map(completeCase))
    const unrelated = {
      ...cases[0]!,
      case_id: 'unrelated-case',
      idea_id: 'unrelated-idea'
    }
    const v4 = manifestFor([unrelated], [completeCase(unrelated)])

    await expect(
      buildImpactComparisonHtml({
        v3Manifest: v3,
        v4Manifest: v4,
        expectedCaseCount: cases.length,
        readPreview: readTestPreview
      })
    ).rejects.toThrow(/unknown case identity/i)
  })

  it.each([
    ['font family', { font_family: 'Barlow Condensed' }],
    ['display transform', { display_transform: 'preserve' as const }],
    ['white fill', { fill_color: '#eeeeee' }],
    ['pure-black stroke', { stroke_color: '#020617' }],
    ['rasterized stroke pixels', { stroke_pixel_count: 0 }],
    ['physical casing', { physical_lines: ['Fixture caption'] }]
  ])(
    'keeps a stale V4 render WIP when its %s evidence is wrong',
    async (_label, layerPatch) => {
      const cases = await firstArchiveCases(1)
      const v3 = manifestFor(cases, cases.map(completeCase))
      const stale = completeCase(cases[0]!)
      const v4 = manifestFor(cases, [
        {
          ...stale,
          revised: {
            ...stale.revised,
            render_checks: {
              ...stale.revised.render_checks!,
              text_layers: stale.revised.render_checks!.text_layers.map(
                (layer) => ({ ...layer, ...layerPatch })
              )
            }
          }
        }
      ])

      const html = await buildImpactComparisonHtml({
        v3Manifest: v3,
        v4Manifest: v4,
        expectedCaseCount: cases.length,
        readPreview: readTestPreview
      })

      expect(html.match(/data-pair-status="wip"[^>]* hidden/g)).toHaveLength(1)
      expect(html).toContain('data-version="v4" data-state="invalid"')
    }
  )

  it('allows preserved-case special styles to qualify without Impact styling', async () => {
    const cases = await firstArchiveCases(1)
    const v3 = manifestFor(cases, cases.map(completeCase))
    const v4 = manifestFor(cases, [specialStyleCase(cases[0]!)])

    const html = await buildImpactComparisonHtml({
      v3Manifest: v3,
      v4Manifest: v4,
      expectedCaseCount: cases.length,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(1)
    expect(html).toContain('data-version="v4" data-state="verified"')
  })
})

describe('V4 to V5 stroke and wrap comparison report', () => {
  it('requires both Impact passes and labels the changed variables truthfully', async () => {
    const cases = await firstArchiveCases(1)
    const v4 = manifestFor(cases, cases.map(completeCase))
    const v5 = manifestFor(cases, cases.map(thinBalancedCase))

    const html = await buildStrokeWrapComparisonHtml({
      v4Manifest: v4,
      v5Manifest: v5,
      expectedCaseCount: cases.length,
      readPreview: readTestPreview
    })

    expect(html).toContain('V4 baseline / V5 thinner stroke + balanced wrap')
    expect(html).toContain('data-version="v4" data-state="verified"')
    expect(html).toContain('data-version="v5" data-state="verified"')
    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(1)
  })

  it('keeps a V5 render WIP when the outline is still the old thickness', async () => {
    const cases = await firstArchiveCases(1)
    const v4 = manifestFor(cases, cases.map(completeCase))
    const stale = thinBalancedCase(cases[0]!)
    const v5 = manifestFor(cases, [
      {
        ...stale,
        revised: {
          ...stale.revised,
          render_checks: {
            ...stale.revised.render_checks!,
            text_layers: stale.revised.render_checks!.text_layers.map(
              (layer) => ({ ...layer, stroke_width_em: 0.1 })
            )
          }
        }
      }
    ])

    const html = await buildStrokeWrapComparisonHtml({
      v4Manifest: v4,
      v5Manifest: v5,
      expectedCaseCount: cases.length,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="wip"[^>]* hidden/g)).toHaveLength(1)
    expect(html).toContain('data-version="v5" data-state="invalid"')
  })

  it('rejects archived-selection drift instead of presenting a false A/B pair', async () => {
    const cases = await firstArchiveCases(1)
    const v4 = manifestFor(cases, cases.map(completeCase))
    const changedCase = {
      ...cases[0]!,
      human_feedback: `${cases[0]!.human_feedback ?? ''} changed`
    }
    const v5 = manifestFor([changedCase], [thinBalancedCase(changedCase)])

    await expect(
      buildStrokeWrapComparisonHtml({
        v4Manifest: v4,
        v5Manifest: v5,
        expectedCaseCount: cases.length,
        readPreview: readTestPreview
      })
    ).rejects.toThrow(/changed the archived selection/i)
  })
})

async function firstArchiveCases(
  count: number
): Promise<readonly ArchiveComparisonCase[]> {
  const selection = await buildArchiveComparisonManifest()
  return selection.cases.slice(0, count)
}

function manifestFor(
  cases: readonly ArchiveComparisonCase[],
  results: ArchiveV3RunManifest['results']
): ArchiveV3RunManifest {
  return {
    schema_version: 1,
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:00:01.000Z',
    codex_version: 'test',
    requested_model: 'test',
    concurrency: 1,
    case_count: cases.length,
    selection: selectionFor(cases),
    results
  }
}

function selectionFor(
  cases: readonly ArchiveComparisonCase[]
): ArchiveComparisonManifest {
  return {
    schema_version: 1,
    selection_policy: {
      total: 50,
      finalized: 25,
      disliked: 25,
      unique_scenarios: true,
      summary: 'test selection'
    },
    cases
  }
}

function completeCase(
  comparisonCase: ArchiveComparisonCase
): ArchiveV3RunManifest['results'][number] {
  return {
    case_id: comparisonCase.case_id,
    idea_id: comparisonCase.idea_id,
    revised: completeResult(comparisonCase.case_id)
  }
}

function invalidCase(
  comparisonCase: ArchiveComparisonCase
): ArchiveV3RunManifest['results'][number] {
  const complete = completeCase(comparisonCase)
  return {
    ...complete,
    revised: {
      ...complete.revised,
      status: 'invalid',
      evaluation_pass: false,
      violations: ['fixture violation']
    }
  }
}

function specialStyleCase(
  comparisonCase: ArchiveComparisonCase
): ArchiveV3RunManifest['results'][number] {
  const complete = completeCase(comparisonCase)
  const plan = complete.revised.plan!
  return {
    ...complete,
    revised: {
      ...complete.revised,
      plan: {
        ...plan,
        presentation: {
          ...plan.presentation,
          template: 'interface',
          zones: plan.presentation.zones.map((zone) => ({
            ...zone,
            style: 'code',
            backdrop: 'solid-panel',
            contrast: 'solid-panel'
          }))
        }
      },
      render_checks: {
        ...complete.revised.render_checks!,
        text_layers: complete.revised.render_checks!.text_layers.map(
          (layer) => ({
            ...layer,
            font_family: 'Geist Mono',
            display_transform: 'preserve',
            physical_lines: ['Fixture caption'],
            stroke_color: null,
            stroke_pixel_count: 0,
            opaque_backplate: true
          })
        )
      }
    }
  }
}

function thinBalancedCase(
  comparisonCase: ArchiveComparisonCase
): ArchiveV3RunManifest['results'][number] {
  const complete = completeCase(comparisonCase)
  return {
    ...complete,
    revised: {
      ...complete.revised,
      render_checks: {
        ...complete.revised.render_checks!,
        text_layers: complete.revised.render_checks!.text_layers.map(
          (layer) => ({
            ...layer,
            wrap_mode: 'balance' as const,
            stroke_width_em: 0.05,
            stroke_width_px: Math.max(1, Math.ceil(layer.font_size_px * 0.05))
          })
        )
      }
    }
  }
}

function completeResult(caseId: string): ArchiveV3RevisedResult {
  return {
    variant: 'revised',
    status: 'complete',
    cache_key: `cache-${caseId}`,
    cache_hit: false,
    attempts: 1,
    duration_ms: 1,
    artifact_directory: '/test',
    render_path: `/test/${caseId}-render.png`,
    preview_path: `/test/${caseId}-preview.png`,
    render_sha256: 'render-sha',
    preview_sha256: 'preview-sha',
    intent: null,
    plan: testPlan(caseId),
    evaluation_pass: true,
    violations: [],
    render_checks: {
      copy_preserved: true,
      glyph_overflow_px: 0,
      zones_inside_canvas: true,
      caption_area: 'overlay',
      minimum_canvas_clearance_px: 12,
      minimum_preview_font_px: 22,
      text_legibility_pass: true,
      text_layers: [
        {
          zone_id: 'caption',
          font_family: 'Impact',
          display_transform: 'uppercase',
          wrap_mode: 'balance',
          font_size_px: 55,
          preview_font_px: 22,
          physical_lines: ['FIXTURE CAPTION'],
          ink_bounds_px: [30, 600, 1140, 100],
          fill_color: '#ffffff',
          stroke_color: '#000000',
          stroke_width_em: 0.1,
          stroke_width_px: 7,
          stroke_pixel_count: 320,
          opaque_backplate: false,
          legibility_pass: true
        }
      ],
      source_frames: [
        {
          image_id: 'fixture-image',
          frame_mode: 'cover',
          target_bounds_px: [0, 0, 1200, 800],
          rendered_bounds_px: [0, 0, 1200, 800]
        }
      ],
      protected_regions: [],
      source_occupancy: {
        minimum_preview_visible_height_px: 320,
        minimum_canvas_height_ratio: 1,
        required_canvas_height_ratio: 0,
        meets_review_floor: true
      }
    },
    blocked_reason: null,
    error: null
  }
}

function testPlan(fixtureId: string): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: fixtureId,
    recognition_hinge: {
      description: 'fixture hinge',
      region_ids: []
    },
    ai_bridges: [
      {
        concept: 'fixture concept',
        connection: 'fixture connection'
      }
    ],
    caption_lines: [{ text: 'Fixture caption', kind: 'original' }],
    format: 'collision',
    presentation: {
      template: 'overlay',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'fixture-image', role: 'single' }],
      zones: [
        {
          id: 'caption',
          line_indexes: [0],
          slot: 'bottom',
          bounds_pct: [5, 75, 90, 20],
          font_size_pct: 5.8,
          rendered_line_count: 1,
          style: 'impact',
          backdrop: 'none',
          contrast: 'outlined',
          palette: 'default',
          anchor_region_id: null,
          indent_levels: [0]
        }
      ]
    },
    why_it_works: 'fixture rationale'
  }
}

async function readTestPreview(): Promise<string> {
  return 'data:image/png;base64,dGVzdA=='
}
