import { describe, expect, it } from 'vitest'

import type {
  ArchiveAbRunManifest,
  ArchiveAbVariant,
  ArchiveAbVariantResult
} from './runner'
import {
  buildArchiveAbHtml,
  type ArchiveAbRevisedResults,
  type ArchiveAbRevisedVariantResult
} from './report'
import { buildArchiveComparisonManifest } from './selection'
import type { MemeEvalPlan } from '../schema'

describe('archive A/B standalone report', () => {
  it('renders 50 comparison rows and 150 cells while revised results are pending', async () => {
    const selection = await buildArchiveComparisonManifest()
    const manifest = manifestFor(
      selection,
      () => failed('current'),
      () => failed('proposed')
    )
    const html = await buildArchiveAbHtml(manifest, { allowPartial: true })

    expect(
      html.match(/<article class="case" data-comparison-row/g)
    ).toHaveLength(50)
    expect(html.match(/data-variant=/g)).toHaveLength(150)
    expect(html.match(/data-variant="revised"/g)).toHaveLength(50)
    expect(html.match(/data-validation="result-pending"/g)).toHaveLength(50)
    expect(html.match(/data-pair-status=/g)).toHaveLength(50)
    expect(html.match(/data-pair-status="wip"/g)).toHaveLength(50)
    expect(html).toContain('data-comparison-list')
    expect(html).toContain('data-report-summary')
    expect(html).toContain('id="status"')
  })

  it('keeps historical invariant failures visible without blocking verified revised rows', async () => {
    const selection = await buildArchiveComparisonManifest()
    const manifest = manifestFor(
      selection,
      (caseId) => completeHistorical('current', caseId, false),
      (caseId) => completeHistorical('proposed', caseId, false)
    )
    const revisedResults = Object.fromEntries(
      selection.cases.map(({ case_id }) => [
        case_id,
        completeRevised(case_id, true)
      ])
    ) satisfies ArchiveAbRevisedResults
    const html = await buildArchiveAbHtml(manifest, {
      revisedResults,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(50)
    expect(
      html.match(
        /data-variant="(?:current|proposed)" data-status="complete" data-validation="historical-invalid"/g
      )
    ).toHaveLength(100)
    expect(
      html.match(
        /data-variant="revised" data-status="complete" data-validation="revised-verified"/g
      )
    ).toHaveLength(50)
  })

  it('keeps a row WIP when revised checks fail or a historical file is missing', async () => {
    const selection = await buildArchiveComparisonManifest()
    const [revisedInvalidCase, historicalMissingCase] = selection.cases
    const manifest = manifestFor(
      selection,
      (caseId) =>
        caseId === historicalMissingCase!.case_id
          ? failed('current')
          : completeHistorical('current', caseId, true),
      (caseId) => completeHistorical('proposed', caseId, true)
    )
    const revisedResults = Object.fromEntries(
      selection.cases.map(({ case_id }) => [
        case_id,
        completeRevised(case_id, case_id !== revisedInvalidCase!.case_id)
      ])
    ) satisfies ArchiveAbRevisedResults
    const html = await buildArchiveAbHtml(manifest, {
      allowPartial: true,
      revisedResults,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(48)
    expect(html.match(/data-pair-status="wip"/g)).toHaveLength(2)
    expect(
      html.match(
        /data-variant="revised" data-status="complete" data-validation="revised-invalid"/g
      )
    ).toHaveLength(1)
  })

  it('keeps a nominally passing row WIP when its revised preview is missing', async () => {
    const selection = await buildArchiveComparisonManifest()
    const missingPreviewCase = selection.cases[0]!
    const manifest = manifestFor(
      selection,
      (caseId) => completeHistorical('current', caseId, true),
      (caseId) => completeHistorical('proposed', caseId, true)
    )
    const revisedResults = Object.fromEntries(
      selection.cases.map(({ case_id }) => [
        case_id,
        case_id === missingPreviewCase.case_id
          ? { ...completeRevised(case_id, true), preview_path: null }
          : completeRevised(case_id, true)
      ])
    ) satisfies ArchiveAbRevisedResults

    const html = await buildArchiveAbHtml(manifest, {
      allowPartial: true,
      revisedResults,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(49)
    expect(html.match(/data-pair-status="wip"/g)).toHaveLength(1)
  })

  it('keeps a nominally passing row WIP below the review readability floor', async () => {
    const selection = await buildArchiveComparisonManifest()
    const unreadableCase = selection.cases[0]!
    const manifest = manifestFor(
      selection,
      (caseId) => completeHistorical('current', caseId, true),
      (caseId) => completeHistorical('proposed', caseId, true)
    )
    const revisedResults = Object.fromEntries(
      selection.cases.map(({ case_id }) => {
        const result = completeRevised(case_id, true)
        return [
          case_id,
          case_id === unreadableCase.case_id
            ? {
                ...result,
                render_checks: {
                  ...result.render_checks!,
                  minimum_preview_font_px: 17.9
                }
              }
            : result
        ]
      })
    ) satisfies ArchiveAbRevisedResults

    const html = await buildArchiveAbHtml(manifest, {
      revisedResults,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(49)
    expect(html.match(/data-pair-status="wip"/g)).toHaveLength(1)
  })

  it('keeps stale revised rows WIP without every occupancy and legibility check', async () => {
    const selection = await buildArchiveComparisonManifest()
    const [missingOccupancy, missingLayerLegibility, missingOverallLegibility] =
      selection.cases
    const manifest = manifestFor(
      selection,
      (caseId) => completeHistorical('current', caseId, true),
      (caseId) => completeHistorical('proposed', caseId, true)
    )
    const revisedResults = Object.fromEntries(
      selection.cases.map(({ case_id }) => {
        const result = completeRevised(case_id, true)
        const checks = result.render_checks!
        if (case_id === missingOccupancy!.case_id) {
          return [
            case_id,
            {
              ...result,
              render_checks: { ...checks, source_occupancy: undefined }
            }
          ]
        }
        if (case_id === missingLayerLegibility!.case_id) {
          return [
            case_id,
            {
              ...result,
              render_checks: {
                ...checks,
                text_layers: checks.text_layers.map((layer) => ({
                  ...layer,
                  legibility_pass: undefined
                }))
              }
            }
          ]
        }
        if (case_id === missingOverallLegibility!.case_id) {
          return [
            case_id,
            {
              ...result,
              render_checks: { ...checks, text_legibility_pass: undefined }
            }
          ]
        }
        return [case_id, result]
      })
    ) satisfies ArchiveAbRevisedResults

    const html = await buildArchiveAbHtml(manifest, {
      revisedResults,
      readPreview: readTestPreview
    })

    expect(html.match(/data-pair-status="ready"/g)).toHaveLength(47)
    expect(html.match(/data-pair-status="wip"/g)).toHaveLength(3)
  })
})

type Selection = Awaited<ReturnType<typeof buildArchiveComparisonManifest>>

function manifestFor(
  selection: Selection,
  current: (caseId: string) => ArchiveAbVariantResult,
  proposed: (caseId: string) => ArchiveAbVariantResult
): ArchiveAbRunManifest {
  return {
    schema_version: 1,
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:00:01.000Z',
    codex_version: 'test',
    requested_model: 'test',
    concurrency: 1,
    case_count: selection.cases.length,
    selection,
    results: selection.cases.map(({ case_id, idea_id }) => ({
      case_id,
      idea_id,
      order: ['current', 'proposed'] as const,
      variants: {
        current: current(case_id),
        proposed: proposed(case_id)
      }
    }))
  }
}

function failed(variant: ArchiveAbVariant): ArchiveAbVariantResult {
  return {
    variant,
    status: 'failed',
    cache_key: '',
    cache_hit: false,
    attempts: 0,
    duration_ms: 0,
    artifact_directory: '',
    render_path: null,
    preview_path: null,
    render_sha256: null,
    preview_sha256: null,
    plan: null,
    evaluation_pass: false,
    violations: [],
    error: 'not run'
  }
}

function completeHistorical(
  variant: ArchiveAbVariant,
  caseId: string,
  evaluationPass: boolean
): ArchiveAbVariantResult {
  return {
    ...failed(variant),
    status: 'complete',
    artifact_directory: '/test',
    render_path: '/test/render.png',
    preview_path: '/test/preview.png',
    render_sha256: 'render-sha',
    preview_sha256: 'preview-sha',
    plan: testPlan(caseId),
    evaluation_pass: evaluationPass,
    violations: evaluationPass ? [] : ['typography.vertical-fit: test'],
    error: null
  }
}

function completeRevised(
  caseId: string,
  evaluationPass: boolean
): ArchiveAbRevisedVariantResult {
  return {
    status: 'complete',
    preview_path: '/test/revised.png',
    plan: testPlan(caseId),
    evaluation_pass: evaluationPass,
    violations: evaluationPass ? [] : ['typography.ink-bounds: test'],
    error: null,
    render_sha256: 'render-sha',
    preview_sha256: 'preview-sha',
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
    blocked_reason: null
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
    caption_lines: [{ text: 'FIXTURE CAPTION', kind: 'original' }],
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
