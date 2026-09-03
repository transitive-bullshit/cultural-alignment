import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import { buildMemeReviewSources } from './catalog'

describe('meme review catalog', () => {
  it('covers exactly the current featured set with reviewable ideas', () => {
    const sources = buildMemeReviewSources()
    const scenarios = sources.flatMap((source) => source.scenarios)
    const featuredSlugs = contentCatalog
      .listScenarioCards({ featuredOnly: true })
      .map(({ slug }) => slug)
      .toSorted()

    expect(scenarios.map(({ slug }) => slug).toSorted()).toEqual(featuredSlugs)
    expect(
      scenarios.every(({ ideas }) => ideas.length >= 3 && ideas.length <= 5)
    ).toBe(true)
    expect(
      new Set(scenarios.flatMap(({ ideas }) => ideas.map(({ id }) => id))).size
    ).toBe(scenarios.reduce((total, { ideas }) => total + ideas.length, 0))
  })

  it('sorts sources and their scenarios for a predictable long queue', () => {
    const sources = buildMemeReviewSources()
    const collator = new Intl.Collator('en', {
      numeric: true,
      sensitivity: 'base'
    })

    expect(sources.map(({ title }) => title)).toEqual(
      sources
        .map(({ title }) => title)
        .toSorted((left, right) => collator.compare(left, right))
    )
    expect(
      sources.every(({ scenarios }) =>
        scenarios
          .map(({ title }) => title)
          .every(
            (title, index, titles) =>
              index === 0 || collator.compare(titles[index - 1]!, title) <= 0
          )
      )
    ).toBe(true)
  })
})
