import { describe, expect, it } from 'vitest'

import { runCodexMemeEval } from './codex-runner'
import { summarizeViolations } from './evaluate'
import { memeSkillFixtures } from './fixtures'

const enabled = process.env.MEME_SKILL_EVALS === '1'
const allowedInCi =
  !process.env.CI || process.env.MEME_SKILL_EVALS_ALLOW_CI === '1'
const selectedFixtureIds = new Set(
  (process.env.MEME_SKILL_EVAL_FIXTURES ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
)
const fixtureLimit = positiveInteger(process.env.MEME_SKILL_EVAL_LIMIT)
const selectedFixtures = memeSkillFixtures
  .filter(
    ({ id }) => selectedFixtureIds.size === 0 || selectedFixtureIds.has(id)
  )
  .slice(0, fixtureLimit)
const childTimeout =
  positiveInteger(process.env.MEME_SKILL_EVAL_TIMEOUT_MS) ?? 180_000
const testTimeout =
  positiveInteger(process.env.MEME_SKILL_EVAL_TEST_TIMEOUT_MS) ??
  childTimeout + 30_000

describe
  .skipIf(!enabled || !allowedInCi)
  .sequential('live Codex meme skill regressions', () => {
    it('selects at least one requested fixture', () => {
      expect(selectedFixtures.length).toBeGreaterThan(0)
    })

    it.for(selectedFixtures)(
      '$id',
      { timeout: testTimeout },
      async (fixture) => {
        const run = await runCodexMemeEval({ fixture })

        expect({
          passed: run.evaluation.pass,
          violations: summarizeViolations(run.evaluation),
          artifacts: run.artifactDirectory
        }).toEqual({
          passed: true,
          violations: 'pass',
          artifacts: run.artifactDirectory
        })
      }
    )
  })

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}
