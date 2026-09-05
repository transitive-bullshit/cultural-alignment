import { describe, expect, it } from 'vitest'

import { fixtureImagePath, memeSkillFixtures } from '../fixtures'

import {
  buildArchiveAbPrompt,
  buildVariantCacheKey,
  getSkillPackageFiles,
  pairOrder
} from './runner'

describe('archive A/B runner', () => {
  it('stages an explicit skill allowlist without adjacent eval files', () => {
    const current = getSkillPackageFiles('current')
    const proposed = getSkillPackageFiles('proposed')

    expect(current.map(({ destination }) => destination)).toEqual([
      'SKILL.md',
      'references/editorial.md',
      'references/revision.md',
      'references/composer-contract.md'
    ])
    expect(proposed.map(({ destination }) => destination)).toEqual([
      'SKILL.md',
      'references/editorial.md',
      'references/composition.md',
      'references/revision.md',
      'references/result-contract.md'
    ])
    expect(
      [...current, ...proposed].every(
        ({ destination }) => !destination.includes('eval')
      )
    ).toBe(true)
  })

  it('alternates pair order deterministically while always running both variants', () => {
    const orders = Array.from({ length: 40 }, (_, index) =>
      pairOrder(`case-${index}`)
    )

    expect(orders.every((order) => new Set(order).size === 2)).toBe(true)
    expect(orders.some(([first]) => first === 'current')).toBe(true)
    expect(orders.some(([first]) => first === 'proposed')).toBe(true)
    expect(pairOrder('case-fixed')).toEqual(pairOrder('case-fixed'))
  })

  it('keeps the prompt fixed and changes the cache key only with the skill package', async () => {
    const sourceFixture = memeSkillFixtures[0]!
    const fixture = {
      ...sourceFixture,
      images: sourceFixture.images.map((image) => ({
        ...image,
        path: fixtureImagePath(sourceFixture, image.id)
      }))
    }
    const prompt = buildArchiveAbPrompt(fixture)
    const requestJson = JSON.stringify(fixture.request)
    const common = {
      fixture,
      requestJson,
      prompt,
      codexVersion: 'codex-cli test',
      model: 'test-model'
    }
    const current = await buildVariantCacheKey({
      ...common,
      variant: 'current'
    })
    const proposed = await buildVariantCacheKey({
      ...common,
      variant: 'proposed'
    })

    expect(prompt).toBe(buildArchiveAbPrompt(fixture))
    expect(current).toMatch(/^[a-f0-9]{64}$/)
    expect(proposed).toMatch(/^[a-f0-9]{64}$/)
    expect(current).not.toBe(proposed)
  })
})
