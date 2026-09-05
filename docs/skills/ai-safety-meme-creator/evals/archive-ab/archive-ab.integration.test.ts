import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { runArchiveAbCli, type ArchiveAbRunManifest } from './runner'

const enabled = process.env.MEME_SKILL_ARCHIVE_AB === '1'
const allowedInCi =
  !process.env.CI || process.env.MEME_SKILL_ARCHIVE_AB_ALLOW_CI === '1'
const timeout = Number.parseInt(
  process.env.MEME_SKILL_ARCHIVE_AB_TEST_TIMEOUT_MS ?? '7200000',
  10
)

describe.skipIf(!enabled || !allowedInCi)('50-scene archive skill A/B', () => {
  it(
    'produces a current and proposed render for every selected scene',
    { timeout },
    async () => {
      const path = await runArchiveAbCli()
      const manifest = JSON.parse(
        await readFile(path, 'utf8')
      ) as ArchiveAbRunManifest
      const variants = manifest.results.flatMap(({ variants }) =>
        Object.values(variants)
      )

      expect(manifest.results).toHaveLength(manifest.case_count)
      expect(variants).toHaveLength(manifest.case_count * 2)
      expect(variants.every(({ status }) => status === 'complete')).toBe(true)
      expect(
        variants.every(({ render_path, preview_path }) =>
          Boolean(render_path && preview_path)
        )
      ).toBe(true)
    }
  )
})
