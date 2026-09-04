import { describe, expect, it } from 'vitest'

import { buildMemeReviewSources, loadMemeReviewCatalog } from './catalog'
import { loadMemeReviewWorkspace } from './rounds'

describe('meme review catalog', () => {
  it('keeps review-only AI bridges that are not in the scenario taxonomy', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const [scenario] = workspace.activeBatch.ideas

    expect(scenario).toBeDefined()

    const scenarioAssets = workspace.activeBatch.assets.filter(
      ({ scenario_slug }) => scenario_slug === scenario!.scenario_slug
    )
    const reviewOnlyConcept = 'Review-only emerging bridge'
    const scenarioWithReviewOnlyConcept = {
      ...scenario!,
      ideas: scenario!.ideas.map((idea, index) =>
        index === 0 ? { ...idea, ai_concept: reviewOnlyConcept } : idea
      )
    }

    const [source] = buildMemeReviewSources(
      [scenarioWithReviewOnlyConcept],
      scenarioAssets
    )

    expect(source?.scenarios[0]?.ideas[0]?.ai_concept).toBe(reviewOnlyConcept)
  })

  it('keeps rendering while a partial status mentions an unpublished scenario', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const unpublishedScenario = 'not-yet-published'
    const catalog = await loadMemeReviewCatalog({
      ...workspace,
      activeBatch: {
        ...workspace.activeBatch,
        status: {
          ...workspace.activeBatch.status,
          status: 'generating',
          reviewable_scenarios: [
            ...workspace.activeBatch.status.reviewable_scenarios,
            unpublishedScenario
          ]
        }
      }
    })

    expect(catalog.reviewableScenarioSlugs.has(unpublishedScenario)).toBe(false)
  })

  it('supports zero, partial, and fully ready scenario sets', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const firstScenarioSlug = workspace.activeBatch.ideas[0]!.scenario_slug
    const cases = [
      { status: 'generating' as const, slugs: [], expected: 0 },
      {
        status: 'generating' as const,
        slugs: [firstScenarioSlug],
        expected: 1
      },
      {
        status: 'ready' as const,
        slugs: [],
        expected: workspace.activeBatch.ideas.length
      }
    ]

    for (const testCase of cases) {
      const catalog = await loadMemeReviewCatalog({
        ...workspace,
        activeBatch: {
          ...workspace.activeBatch,
          status: {
            ...workspace.activeBatch.status,
            status: testCase.status,
            reviewable_scenarios: testCase.slugs
          }
        }
      })

      expect(catalog.reviewableScenarioSlugs.size).toBe(testCase.expected)
    }
  })

  it('covers exactly the active batch scenario set with reviewable ideas', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const sources = buildMemeReviewSources(
      workspace.activeBatch.ideas,
      workspace.activeBatch.assets
    )
    const scenarios = sources.flatMap((source) => source.scenarios)
    const activeSlugs = workspace.activeBatch.ideas
      .map(({ scenario_slug }) => scenario_slug)
      .toSorted()

    expect(scenarios.map(({ slug }) => slug).toSorted()).toEqual(activeSlugs)
    expect(scenarios.every(({ ideas }) => ideas.length >= 1)).toBe(true)
    expect(
      new Set(scenarios.flatMap(({ ideas }) => ideas.map(({ id }) => id))).size
    ).toBe(scenarios.reduce((total, { ideas }) => total + ideas.length, 0))
  })

  it('sorts sources and their scenarios for a predictable long queue', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const sources = buildMemeReviewSources(
      workspace.activeBatch.ideas,
      workspace.activeBatch.assets
    )
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

  it('resolves every preview asset inside its own scenario', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const scenarios = buildMemeReviewSources(
      workspace.activeBatch.ideas,
      workspace.activeBatch.assets
    ).flatMap(({ scenarios }) => scenarios)

    expect(
      scenarios.every((scenario) => {
        const assetsById = new Map(
          scenario.assets.map((asset) => [asset.id, asset])
        )

        return scenario.ideas.every((idea) =>
          idea.preview.asset_ids.every(
            (assetId) =>
              assetsById.get(assetId)?.scenario_slug === scenario.slug
          )
        )
      })
    ).toBe(true)
  })

  it('exposes every older version of a surviving lineage', async () => {
    const workspace = await loadMemeReviewWorkspace()
    const catalog = await loadMemeReviewCatalog(workspace)
    const expectedIdSet = new Set<string>()

    for (const batch of workspace.historySnapshots) {
      if (batch.renderer === 1) {
        for (const scenario of batch.ideas) {
          for (const idea of scenario.ideas) {
            if (catalog.ideaIds.has(idea.id)) {
              expectedIdSet.add(idea.id)
            }
          }
        }
      } else {
        for (const scenario of batch.ideas) {
          for (const idea of scenario.ideas) {
            if (
              catalog.ideaIds.has(idea.id) &&
              (batch.kind === 'batch' || batch.feedback.feedback[idea.id])
            ) {
              expectedIdSet.add(idea.id)
            }
          }
        }
      }
    }

    const expectedIds = [...expectedIdSet].toSorted()

    expect(Object.keys(catalog.historyByIdeaId).toSorted()).toEqual(expectedIds)
    expect(
      Object.values(catalog.historyByIdeaId).every((entries) =>
        entries.every(
          ({ revisionKey, idea }) =>
            revisionKey !== catalog.activeRevisionKey &&
            catalog.ideaIds.has(idea.id)
        )
      )
    ).toBe(true)
  })
})
