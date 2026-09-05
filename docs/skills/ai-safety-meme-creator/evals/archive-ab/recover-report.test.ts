import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { recoverArchiveComparisonReport } from './recover-report'

describe('archive comparison report recovery', () => {
  it('preserves historical cells and replaces only revised cells from a complete v3 manifest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const backupPath = join(directory, 'comparison.before-recovery.html')
    const previewPath = join(directory, 'new-preview.png')
    const original = historicalHtml()
    await Promise.all([
      writeFile(htmlPath, original, 'utf8'),
      writeFile(
        manifestPath,
        `${JSON.stringify(v3Manifest(previewPath))}\n`,
        'utf8'
      ),
      writeFile(previewPath, Buffer.from('new-preview'))
    ])

    const result = await recoverArchiveComparisonReport({
      htmlPath,
      manifestPath,
      backupPath,
      expectedCaseCount: 2
    })

    const updated = await readFile(htmlPath, 'utf8')
    expect(await readFile(backupPath, 'utf8')).toBe(original)
    expect(updated).toContain(currentCell('A'))
    expect(updated).toContain(proposedCell('A'))
    expect(updated).toContain(currentCell('B'))
    expect(updated).toContain(proposedCell('B'))
    expect(updated).not.toContain('OLD REVISED A')
    expect(updated).not.toContain('OLD REVISED B')
    expect(updated).toContain('data-idea-id="idea-a"')
    expect(updated).toContain('data-case-id="case-a"')
    expect(
      updated.match(/<article[^>]*data-idea-id="idea-a"[^>]*>/)?.[0]
    ).toContain('data-pair-status="ready"')
    expect(
      updated.match(/<article[^>]*data-idea-id="idea-b"[^>]*>/)?.[0]
    ).toContain('data-pair-status="wip"')
    expect(updated).toContain('data:image/png;base64,bmV3LXByZXZpZXc=')
    expect(updated).toContain('protected_region_conflict: face would be hidden')
    expect(updated).toContain('1/2 three-way comparisons ready')
    expect(updated).toContain('1/2 v3 renders verified · 1 produced')
    expect(updated).toContain('revised v3 checks: 1/2 passed · 1 note')
    expect(result).toMatchObject({
      rowCount: 2,
      readyCount: 1,
      verifiedRevisedCount: 1,
      producedRevisedCount: 1,
      backupPath
    })
  })

  it('refuses an incomplete v3 manifest before backing up or changing the page', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const backupPath = join(directory, 'comparison.before-recovery.html')
    const original = historicalHtml()
    const incomplete = v3Manifest(join(directory, 'new-preview.png'))
    incomplete.results = incomplete.results.slice(0, 1)
    await Promise.all([
      writeFile(htmlPath, original, 'utf8'),
      writeFile(manifestPath, `${JSON.stringify(incomplete)}\n`, 'utf8')
    ])

    await expect(
      recoverArchiveComparisonReport({
        htmlPath,
        manifestPath,
        backupPath,
        expectedCaseCount: 2
      })
    ).rejects.toThrow(/manifest declares 2 cases but contains 1 result/i)

    expect(await readFile(htmlPath, 'utf8')).toBe(original)
    await expect(access(backupPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('uses recovered identity hooks without duplicating them on a later update', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const previewPath = join(directory, 'new-preview.png')
    await Promise.all([
      writeFile(htmlPath, historicalHtml(), 'utf8'),
      writeFile(
        manifestPath,
        `${JSON.stringify(v3Manifest(previewPath))}\n`,
        'utf8'
      ),
      writeFile(previewPath, Buffer.from('new-preview'))
    ])

    await recoverArchiveComparisonReport({
      htmlPath,
      manifestPath,
      backupPath: join(directory, 'first-backup.html'),
      expectedCaseCount: 2
    })
    await recoverArchiveComparisonReport({
      htmlPath,
      manifestPath,
      backupPath: join(directory, 'second-backup.html'),
      expectedCaseCount: 2
    })

    const updated = await readFile(htmlPath, 'utf8')
    expect(updated.match(/data-case-id="case-a"/g)).toHaveLength(1)
    expect(updated.match(/data-idea-id="idea-a"/g)).toHaveLength(1)
    expect(updated).toContain(currentCell('A'))
    expect(updated).toContain(proposedCell('A'))
  })

  it('requires the production page to contain all 50 cases by default', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const backupPath = join(directory, 'comparison.before-recovery.html')
    const previewPath = join(directory, 'new-preview.png')
    await Promise.all([
      writeFile(htmlPath, historicalHtml(), 'utf8'),
      writeFile(
        manifestPath,
        `${JSON.stringify(v3Manifest(previewPath))}\n`,
        'utf8'
      ),
      writeFile(previewPath, Buffer.from('new-preview'))
    ])

    await expect(
      recoverArchiveComparisonReport({ htmlPath, manifestPath, backupPath })
    ).rejects.toThrow(/recovery requires exactly 50 cases/i)
    await expect(access(backupPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps a complete render below the readability floor in WIP', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const previewPath = join(directory, 'new-preview.png')
    const manifest = v3Manifest(previewPath)
    manifest.results[0]!.revised.render_checks!.minimum_preview_font_px = 17.9
    await Promise.all([
      writeFile(htmlPath, historicalHtml(), 'utf8'),
      writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8'),
      writeFile(previewPath, Buffer.from('new-preview'))
    ])

    const result = await recoverArchiveComparisonReport({
      htmlPath,
      manifestPath,
      backupPath: join(directory, 'backup.html'),
      expectedCaseCount: 2
    })

    expect(result.readyCount).toBe(0)
    expect(result.verifiedRevisedCount).toBe(0)
  })

  it('keeps a stale complete render without occupancy and legibility evidence in WIP', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-report-recovery-'))
    const htmlPath = join(directory, 'comparison.html')
    const manifestPath = join(directory, 'v3.json')
    const previewPath = join(directory, 'new-preview.png')
    const manifest = v3Manifest(previewPath)
    const checks = manifest.results[0]!.revised.render_checks!
    const staleChecks = checks as unknown as {
      source_occupancy?: (typeof checks)['source_occupancy']
      text_legibility_pass?: boolean
      text_layers: { legibility_pass?: boolean }[]
    }
    delete staleChecks.source_occupancy
    delete staleChecks.text_legibility_pass
    for (const layer of staleChecks.text_layers) delete layer.legibility_pass
    await Promise.all([
      writeFile(htmlPath, historicalHtml(), 'utf8'),
      writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8'),
      writeFile(previewPath, Buffer.from('new-preview'))
    ])

    const result = await recoverArchiveComparisonReport({
      htmlPath,
      manifestPath,
      backupPath: join(directory, 'backup.html'),
      expectedCaseCount: 2
    })

    expect(result.readyCount).toBe(0)
    expect(result.verifiedRevisedCount).toBe(0)
  })
})

function historicalHtml(): string {
  return `<!doctype html>
<html><body>
<div class="summary" data-report-summary>
  <span>2 scenes</span>
  <span>2/2 three-way comparisons ready</span>
  <span>4/4 historical renders available</span>
  <span>2/2 v3 renders verified · 2 produced</span>
  <span>0 copy differences</span>
  <span>0 template differences</span>
  <span>current historical checks: 0/2 passed · 3 notes</span>
  <span>proposed historical checks: 0/2 passed · 4 notes</span>
  <span>revised v3 checks: 2/2 passed · 0 notes</span>
  <span>old-codex</span>
  <span>old-model</span>
</div>
<main data-comparison-list>
${row('A', 'idea-a')}
${row('B', 'idea-b')}
</main>
</body></html>`
}

function row(label: string, ideaId: string): string {
  return `<article class="case" data-comparison-row data-pair-status="ready" data-copy="false" data-template="false" data-notes="true" data-revised-invalid="false" data-failure="false" data-search="old ${ideaId}">
  <div class="case-head"><span class="badge pair-ready">ready</span><span class="quiet">Concept · collision · ${ideaId}</span></div>
  <div class="pair">
    ${currentCell(label)}
    ${proposedCell(label)}
    <section class="variant" data-variant="revised" data-status="complete" data-validation="revised-verified"><p>OLD REVISED ${label}</p></section>
  </div>
</article>`
}

function currentCell(label: string): string {
  return `<section class="variant" data-variant="current" data-status="complete" data-validation="historical-invalid"><img src="data:image/png;base64,YQ=="><p class="caption">CURRENT ${label}</p><p class="plan">overlay · cover</p></section>`
}

function proposedCell(label: string): string {
  return `<section class="variant" data-variant="proposed" data-status="complete" data-validation="historical-invalid"><img src="data:image/png;base64,Yg=="><p class="caption">PROPOSED ${label}</p><p class="plan">overlay · cover</p></section>`
}

function v3Manifest(previewPath: string) {
  return {
    schema_version: 1,
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:01:00.000Z',
    codex_version: 'new-codex',
    requested_model: 'new-model',
    concurrency: 1,
    case_count: 2,
    selection: {
      schema_version: 1,
      cases: [
        { case_id: 'case-a', idea_id: 'idea-a' },
        { case_id: 'case-b', idea_id: 'idea-b' }
      ]
    },
    results: [
      {
        case_id: 'case-a',
        idea_id: 'idea-a',
        revised: {
          variant: 'revised',
          status: 'complete',
          cache_key: 'cache-a',
          cache_hit: false,
          attempts: 1,
          duration_ms: 1,
          artifact_directory: '/tmp/a',
          render_path: '/tmp/a/render.png',
          preview_path: previewPath,
          render_sha256: 'a'.repeat(64),
          preview_sha256: 'b'.repeat(64),
          intent: null,
          plan: testPlan('case-a', 'NEW REVISED A'),
          evaluation_pass: true,
          violations: [],
          render_checks: {
            copy_preserved: true,
            glyph_overflow_px: 0,
            zones_inside_canvas: true,
            caption_area: 'external',
            minimum_canvas_clearance_px: 24,
            minimum_preview_font_px: 28,
            text_legibility_pass: true,
            text_layers: [
              {
                zone_id: 'caption',
                font_size_px: 70,
                preview_font_px: 28,
                physical_lines: ['NEW REVISED A'],
                ink_bounds_px: [30, 600, 1140, 100],
                fill_color: '#ffffff',
                stroke_color: null,
                opaque_backplate: true,
                legibility_pass: true
              }
            ],
            source_frames: [
              {
                image_id: 'source-a',
                frame_mode: 'contain',
                target_bounds_px: [0, 0, 1200, 560],
                rendered_bounds_px: [0, 0, 1200, 560]
              }
            ],
            protected_regions: [
              {
                region_id: 'face',
                image_id: 'source-a',
                priority: 'must',
                visible_ratio: 1,
                canvas_bounds_px: [400, 20, 200, 200],
                caption_overlap_px: 0
              }
            ],
            source_occupancy: {
              minimum_preview_visible_height_px: 224,
              minimum_canvas_height_ratio: 0.7,
              required_canvas_height_ratio: 0,
              meets_review_floor: true
            }
          },
          blocked_reason: null,
          error: null
        }
      },
      {
        case_id: 'case-b',
        idea_id: 'idea-b',
        revised: {
          variant: 'revised',
          status: 'blocked',
          cache_key: 'cache-b',
          cache_hit: false,
          attempts: 3,
          duration_ms: 1,
          artifact_directory: '/tmp/b',
          render_path: null,
          preview_path: null,
          render_sha256: null,
          preview_sha256: null,
          intent: null,
          plan: null,
          evaluation_pass: false,
          violations: [
            'render.blocked: protected_region_conflict: face would be hidden'
          ],
          render_checks: null,
          blocked_reason: {
            code: 'protected_region_conflict',
            message: 'face would be hidden'
          },
          error: null
        }
      }
    ]
  }
}

function testPlan(fixtureId: string, caption: string) {
  return {
    version: 1,
    fixture_id: fixtureId,
    recognition_hinge: { description: 'hinge', region_ids: ['face'] },
    ai_bridges: [{ concept: 'concept', connection: 'connection' }],
    caption_lines: [{ text: caption, kind: 'original' }],
    format: 'collision',
    presentation: {
      template: 'band-bottom',
      frame_mode: 'contain',
      source_frames: [{ image_id: 'source-a', role: 'single' }],
      zones: [
        {
          id: 'caption',
          line_indexes: [0],
          slot: 'bottom',
          bounds_pct: [2, 70, 96, 28],
          font_size_pct: 6,
          rendered_line_count: 1,
          style: 'impact',
          backdrop: 'solid-panel',
          contrast: 'solid-panel',
          palette: 'default',
          anchor_region_id: null,
          indent_levels: [0]
        }
      ]
    },
    why_it_works: 'fixture rationale'
  }
}
