import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildArchiveComparisonManifest } from './selection'
import { runArchiveV3Comparison } from './v3-runner'

const enabled = process.env.MEME_SKILL_EVALS === '1'
const allowedInCi =
  !process.env.CI || process.env.MEME_SKILL_EVALS_ALLOW_CI === '1'
const selectedIds = new Set(
  (process.env.MEME_SKILL_EVAL_FIXTURES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
)

describe
  .skipIf(!enabled || !allowedInCi)
  .sequential('live Codex semantic meme regressions', () => {
    let artifactRoot = ''

    beforeAll(async () => {
      artifactRoot = await mkdtemp(join(tmpdir(), 'meme-skill-v3-live-'))
    })

    afterAll(async () => {
      if (artifactRoot) {
        await rm(artifactRoot, { recursive: true, force: true })
      }
    })

    it(
      'runs semantic intent through measured composition before completing',
      { timeout: liveTimeout() },
      async () => {
        const selection = await buildArchiveComparisonManifest()
        const cases = selection.cases
          .filter(
            ({ case_id, idea_id }) =>
              selectedIds.size === 0 ||
              selectedIds.has(case_id) ||
              selectedIds.has(idea_id)
          )
          .slice(0, positiveInteger(process.env.MEME_SKILL_EVAL_LIMIT, 1))
        expect(cases.length).toBeGreaterThan(0)

        const run = await runArchiveV3Comparison({
          cases,
          artifactRoot,
          concurrency: 1,
          timeoutMs: positiveInteger(
            process.env.MEME_SKILL_EVAL_TIMEOUT_MS,
            240_000
          )
        })

        for (const { revised } of run.results) {
          expect(revised.status).toBe('complete')
          expect(revised.evaluation_pass).toBe(true)
          expect(revised.render_sha256).toMatch(/^[a-f0-9]{64}$/)
          expect(revised.preview_sha256).toMatch(/^[a-f0-9]{64}$/)
          expect(revised.render_checks).toMatchObject({
            copy_preserved: true,
            glyph_overflow_px: 0,
            zones_inside_canvas: true
          })
          expect(
            revised.render_checks?.protected_regions.every(
              ({ priority, visible_ratio, caption_overlap_px }) =>
                priority !== 'must' ||
                (visible_ratio >= 0.995 && caption_overlap_px === 0)
            )
          ).toBe(true)
        }
      }
    )
  })

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function liveTimeout(): number {
  const childTimeout = positiveInteger(
    process.env.MEME_SKILL_EVAL_TIMEOUT_MS,
    240_000
  )
  const fixtureLimit = positiveInteger(process.env.MEME_SKILL_EVAL_LIMIT, 1)
  return childTimeout * fixtureLimit * 3 + 30_000
}
