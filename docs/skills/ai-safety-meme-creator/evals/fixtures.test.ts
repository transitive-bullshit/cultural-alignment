import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  fixtureImagePath,
  memeSkillFixtures,
  toAgentVisibleFixture,
  workspaceDirectory
} from './fixtures'

describe('meme skill regression fixtures', () => {
  it('keeps fixture, image, and protected-region identities unambiguous', () => {
    const problems: string[] = []
    expect(new Set(memeSkillFixtures.map(({ id }) => id)).size).toBe(
      memeSkillFixtures.length
    )

    for (const fixture of memeSkillFixtures) {
      const imageIds = new Set(fixture.images.map(({ id }) => id))
      const regionIds = new Set(fixture.protected_regions.map(({ id }) => id))

      if (imageIds.size !== fixture.images.length) {
        problems.push(`${fixture.id}: duplicate image id`)
      }
      if (regionIds.size !== fixture.protected_regions.length) {
        problems.push(`${fixture.id}: duplicate protected-region id`)
      }
      if (
        !fixture.protected_regions.every(({ image_id }) =>
          imageIds.has(image_id)
        )
      ) {
        problems.push(
          `${fixture.id}: protected region references unknown image`
        )
      }
      if (
        !fixture.expectations.expected_source_frames.every(({ image_id }) =>
          imageIds.has(image_id)
        )
      ) {
        problems.push(`${fixture.id}: expected source references unknown image`)
      }
      if (
        !(fixture.expectations.required_region_ids ?? []).every((regionId) =>
          regionIds.has(regionId)
        )
      ) {
        problems.push(`${fixture.id}: expectation references unknown region`)
      }
    }

    expect(problems).toEqual([])
  })

  it('uses valid local raster fixtures with their declared state frames distinct', async () => {
    const problems: string[] = []
    for (const fixture of memeSkillFixtures) {
      const hashes = []
      for (const image of fixture.images) {
        const path = fixtureImagePath(fixture, image.id)
        await access(path)
        const bytes = await readFile(path)
        const metadata = await sharp(bytes).metadata()

        if (metadata.format !== 'png') {
          problems.push(`${fixture.id}: ${image.id} is not PNG`)
        }
        if (!metadata.width || metadata.width < 600) {
          problems.push(`${fixture.id}: ${image.id} is narrower than 600px`)
        }
        if (metadata.height !== 800) {
          problems.push(`${fixture.id}: ${image.id} is not 800px high`)
        }
        hashes.push(createHash('sha256').update(bytes).digest('hex'))
      }

      if (
        fixture.expectations.require_distinct_source_frames &&
        new Set(hashes).size !== hashes.length
      ) {
        problems.push(`${fixture.id}: source frames are not distinct`)
      }
    }

    expect(problems).toEqual([])
  })

  it('resolves every golden-feedback anchor to its immutable review note', async () => {
    const documents = new Map<string, unknown>()
    const problems: string[] = []

    for (const fixture of memeSkillFixtures) {
      for (const source of fixture.feedback_sources) {
        const path = resolve(workspaceDirectory, source.path)
        let raw = documents.get(path)
        if (!raw) {
          raw = JSON.parse(await readFile(path, 'utf8'))
          documents.set(path, raw)
        }

        const document = raw as {
          feedback?: Record<
            string,
            { readonly rating?: string; readonly notes?: string }
          >
        }
        const entry = document.feedback?.[source.idea_id]
        if (!entry) {
          problems.push(`${fixture.id}: missing ${source.idea_id}`)
          continue
        }
        if ((entry.rating || 'unrated') !== source.rating) {
          problems.push(`${fixture.id}: ${source.idea_id} rating changed`)
        }
        if (
          !entry.notes
            ?.toLocaleLowerCase()
            .includes(source.note_includes.toLocaleLowerCase())
        ) {
          problems.push(`${fixture.id}: ${source.idea_id} note changed`)
        }
      }
    }

    expect(problems).toEqual([])
  })

  it('covers the manually recurring presentation and editorial regressions', () => {
    const tags = new Set(memeSkillFixtures.flatMap(({ tags }) => tags))
    const requiredCoverage = [
      'protected-hinge',
      'zone-overlap',
      'setup-payoff',
      'state-contrast',
      'frame-order',
      'large-type',
      'wrapping',
      'text-on-text',
      'punctuation',
      'indentation',
      'contrast',
      'fallback',
      'rejection',
      'one-bridge',
      'canon-accuracy',
      'locked-copy'
    ]

    expect(requiredCoverage.filter((tag) => !tags.has(tag))).toEqual([])
  })

  it('does not leak hidden expectations or curated feedback into agent prompts', () => {
    for (const fixture of memeSkillFixtures) {
      const visible = JSON.stringify(toAgentVisibleFixture(fixture))

      expect(visible).not.toContain('expectations')
      expect(visible).not.toContain('feedback_sources')
      expect(visible).not.toContain('canvas_rect_pct')
      for (const source of fixture.feedback_sources) {
        expect(visible).not.toContain(source.note_includes)
      }
    }
  })
})
