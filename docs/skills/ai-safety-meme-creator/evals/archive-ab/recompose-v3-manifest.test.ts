import { createHash } from 'node:crypto'
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import {
  recomposeArchiveV3Manifest,
  runRecomposeArchiveV3ManifestCli
} from './recompose-v3-manifest'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('archive v3 deterministic recomposition', () => {
  it('re-renders stored intent into isolated artifacts and atomically refreshes the manifest', async () => {
    const setup = await archiveSetup()
    const originalSource = `${JSON.stringify(setup.manifest, null, 2)}\n`
    await writeFile(setup.manifestPath, originalSource, 'utf8')

    const result = await recomposeArchiveV3Manifest({
      manifestPath: setup.manifestPath,
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1
    })

    const updated = JSON.parse(await readFile(setup.manifestPath, 'utf8'))
    const revised = updated.results[0].revised
    expect({ ...updated, results: [] }).toEqual({
      ...setup.manifest,
      results: []
    })
    expect(revised).toMatchObject({
      variant: 'revised',
      status: 'complete',
      cache_hit: false,
      attempts: 2,
      duration_ms: 321,
      evaluation_pass: true,
      violations: [],
      blocked_reason: null,
      error: null,
      intent: setup.manifest.results[0]!.revised.intent,
      render_checks: {
        copy_preserved: true,
        glyph_overflow_px: 0,
        zones_inside_canvas: true,
        source_occupancy: {
          meets_review_floor: true
        }
      }
    })
    expect(revised.cache_key).toMatch(/^recomposed-v1-[a-f0-9]{64}$/)
    expect(revised.cache_key).not.toBe('old-agent-cache')
    expect(revised.artifact_directory).toContain(
      `${join('cache', 'case-a', 'recomposed')}/`
    )
    expect(revised.render_path).toBe(
      join(revised.artifact_directory, 'render.png')
    )
    expect(revised.preview_path).toBe(
      join(revised.artifact_directory, 'preview.png')
    )
    await Promise.all([
      access(revised.render_path),
      access(revised.preview_path)
    ])
    expect(revised.render_sha256).toBe(await sha256File(revised.render_path))
    expect(revised.preview_sha256).toBe(await sha256File(revised.preview_path))
    expect(await readFile(result.backupPath, 'utf8')).toBe(originalSource)
    expect(result).toMatchObject({
      manifestPath: setup.manifestPath,
      caseCount: 1,
      completeCount: 1,
      invalidCount: 0,
      blockedCount: 0
    })
    expect(
      (await readdir(join(setup.artifactRoot, 'cache', 'case-a'))).sort()
    ).toEqual(['recomposed'])
    expect(
      (await readdir(join(setup.directory))).some((name) =>
        name.endsWith('.tmp')
      )
    ).toBe(false)
  })

  it('records a new renderer block with no stale render or preview', async () => {
    const setup = await archiveSetup()
    const impossibleCopy = 'UNBREAKABLE'.repeat(500)
    setup.manifest.selection.cases[0]!.idea.caption_lines = [impossibleCopy]
    setup.manifest.results[0]!.revised.intent.caption_lines[0]!.text =
      impossibleCopy
    await writeFile(
      setup.manifestPath,
      `${JSON.stringify(setup.manifest, null, 2)}\n`,
      'utf8'
    )

    const result = await recomposeArchiveV3Manifest({
      manifestPath: setup.manifestPath,
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1
    })

    const updated = JSON.parse(await readFile(setup.manifestPath, 'utf8'))
    const revised = updated.results[0].revised
    expect(revised).toMatchObject({
      status: 'blocked',
      render_path: null,
      preview_path: null,
      render_sha256: null,
      preview_sha256: null,
      plan: null,
      evaluation_pass: false,
      render_checks: null,
      blocked_reason: { code: 'unplaceable_text' }
    })
    expect(revised.violations[0]).toMatch(/^render\.blocked:/)
    expect(result).toMatchObject({
      completeCount: 0,
      invalidCount: 0,
      blockedCount: 1
    })
    expect(await readdir(revised.artifact_directory)).not.toEqual(
      expect.arrayContaining(['render.png', 'preview.png'])
    )
  })

  it('renders a stored intent before applying newer editorial validation', async () => {
    const setup = await archiveSetup()
    const comparisonCase = setup.manifest.selection.cases[0]!
    const editableFeedback = comparisonCase as {
      human_feedback: string | null
    }
    comparisonCase.cohort = 'disliked'
    comparisonCase.human_rating = 'dislike'
    comparisonCase.locked_copy = false
    editableFeedback.human_feedback = 'Human rating: dislike. Replace this.'
    comparisonCase.idea.caption_lines = ['THE OLD REJECTED COPY']
    setup.manifest.results[0]!.revised.intent.caption_lines[0]!.text =
      'THE NEW COPY'
    setup.manifest.results[0]!.revised.intent.format = 'source-native interface'
    await writeFile(
      setup.manifestPath,
      `${JSON.stringify(setup.manifest, null, 2)}\n`,
      'utf8'
    )

    const result = await recomposeArchiveV3Manifest({
      manifestPath: setup.manifestPath,
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1
    })

    const updated = JSON.parse(await readFile(setup.manifestPath, 'utf8'))
    expect(updated.results[0].revised).toMatchObject({
      status: 'invalid',
      evaluation_pass: false,
      violations: [expect.stringMatching(/^revision\.rejected-format:/)],
      intent: { format: 'collision' },
      blocked_reason: null,
      error: null
    })
    await Promise.all([
      access(updated.results[0].revised.render_path),
      access(updated.results[0].revised.preview_path)
    ])
    expect(result).toMatchObject({
      completeCount: 0,
      invalidCount: 1,
      blockedCount: 0
    })
  })

  it('refuses a missing stored intent before creating a backup or changing the manifest', async () => {
    const setup = await archiveSetup()
    const revisedWithMissingIntent = setup.manifest.results[0]!.revised as {
      intent: unknown
    }
    revisedWithMissingIntent.intent = null
    const originalSource = `${JSON.stringify(setup.manifest, null, 2)}\n`
    await writeFile(setup.manifestPath, originalSource, 'utf8')

    await expect(
      recomposeArchiveV3Manifest({
        manifestPath: setup.manifestPath,
        artifactRoot: setup.artifactRoot,
        expectedCaseCount: 1
      })
    ).rejects.toThrow(/case-a.*stored semantic intent/i)

    expect(await readFile(setup.manifestPath, 'utf8')).toBe(originalSource)
    expect(
      (await readdir(setup.directory)).filter((name) =>
        name.includes('before-recompose')
      )
    ).toEqual([])
  })

  it('exposes the same in-place operation through a positional CLI', async () => {
    const setup = await archiveSetup()
    await writeFile(setup.manifestPath, JSON.stringify(setup.manifest), 'utf8')

    const output = JSON.parse(
      await runRecomposeArchiveV3ManifestCli([setup.manifestPath], {
        artifactRoot: setup.artifactRoot,
        expectedCaseCount: 1
      })
    )

    expect(output).toMatchObject({
      manifestPath: setup.manifestPath,
      caseCount: 1,
      completeCount: 1
    })
  })
})

async function archiveSetup() {
  const directory = await mkdtemp(join(tmpdir(), 'meme-v3-recompose-'))
  temporaryDirectories.push(directory)
  const artifactRoot = join(directory, 'artifacts')
  const sourcePath = join(directory, 'source.png')
  await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: '#334155'
    }
  })
    .png()
    .toFile(sourcePath)
  const sourceHash = await sha256File(sourcePath)
  const cachedSourcePath = join(artifactRoot, 'sources', `${sourceHash}.png`)
  await mkdir(join(artifactRoot, 'sources'), { recursive: true })
  await copyFile(sourcePath, cachedSourcePath)
  const intent = {
    version: 2,
    fixture_id: 'case-a',
    recognition_hinge: {
      description: 'The visible face carries the scene',
      region_ids: ['face']
    },
    ai_bridge: {
      concept: 'evaluation gaming',
      connection: 'The system optimizes the visible test'
    },
    caption_lines: [
      {
        text: 'THE SYSTEM LEARNS THE TEST',
        kind: 'original',
        role: 'only',
        anchor_region_id: null,
        indent_level: 0
      }
    ],
    format: 'collision',
    presentation: {
      mode: 'single',
      source_frames: [{ image_id: 'source-frame', role: 'single' }],
      preferred_edge: 'auto',
      palette: 'default'
    },
    why_it_works: 'The caption and visible evidence form one collision'
  }
  const comparisonCase = {
    case_id: 'case-a',
    cohort: 'finalized',
    source_round: 5,
    idea_id: 'idea-a',
    scenario_slug: 'scenario-a',
    scenario_title: 'Scenario A',
    source_title: 'Source A',
    human_rating: 'like',
    human_feedback: null,
    locked_copy: true,
    feedback_source: 'feedback/a.json',
    finalized_version: null,
    idea: {
      id: 'idea-a',
      ai_concept: 'evaluation gaming',
      display_context: 'A system notices the test',
      source_anchor: 'A visible face',
      caption_lines: ['THE SYSTEM LEARNS THE TEST'],
      format: 'collision',
      frame_guidance: 'Keep the face visible',
      why_it_works: 'The system notices the test',
      preview: { template: 'overlay', frame_mode: 'contain' }
    },
    scenario: {
      scene: 'A system notices the test and changes its behavior.',
      why_analogy_works: 'The visible behavior is strategically selected.',
      caveats: []
    },
    source_assets: [
      {
        id: 'source-frame',
        scenario_slug: 'scenario-a',
        src: 'https://invalid.example/source.png',
        width: 1200,
        height: 800,
        alt: 'A face in the center',
        content_hash: sourceHash,
        protected_regions: [
          {
            id: 'face',
            label: 'central face',
            priority: 'must',
            source_rect: [40, 35, 20, 30]
          }
        ]
      }
    ]
  }
  const manifest = {
    schema_version: 1,
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:01:00.000Z',
    codex_version: 'codex 1.2.3',
    requested_model: 'test-model',
    concurrency: 4,
    case_count: 1,
    selection: {
      schema_version: 1,
      selection_policy: {
        total: 1,
        finalized: 1,
        disliked: 0,
        unique_scenarios: true,
        summary: 'One deterministic test case'
      },
      cases: [comparisonCase]
    },
    results: [
      {
        case_id: 'case-a',
        idea_id: 'idea-a',
        revised: {
          variant: 'revised',
          status: 'complete',
          cache_key: 'old-agent-cache',
          cache_hit: false,
          attempts: 2,
          duration_ms: 321,
          artifact_directory: '/old/artifact',
          render_path: '/old/render.png',
          preview_path: '/old/preview.png',
          render_sha256: 'a'.repeat(64),
          preview_sha256: 'b'.repeat(64),
          intent,
          plan: null,
          evaluation_pass: true,
          violations: [],
          render_checks: null,
          blocked_reason: null,
          error: null
        }
      }
    ]
  }
  return {
    directory,
    artifactRoot,
    manifestPath: join(directory, 'run-manifest.json'),
    manifest,
    sourcePath
  }
}

async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}
