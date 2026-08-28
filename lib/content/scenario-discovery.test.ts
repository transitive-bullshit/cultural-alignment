import { describe, expect, it } from 'vitest'

import { discoverScenarios } from './scenario-discovery'

type TestScenario = {
  readonly id: string
  readonly slug: string
  readonly sourceId: string
  readonly riskFamilyIds: readonly string[]
  readonly conceptIds: readonly string[]
}

describe('scenario discovery', () => {
  it('takes the first three other scenarios from the current source', () => {
    const current = scenario('current', 'source-a', ['risk-a'], ['concept-a'])
    const first = scenario('first', 'source-a', [], [])
    const second = scenario('second', 'source-a', [], [])
    const third = scenario('third', 'source-a', [], [])

    const discovery = discoverScenarios(current, [
      first,
      current,
      second,
      third
    ])

    expect(discovery.moreFromSource.map(({ slug }) => slug)).toEqual([
      'first',
      'second',
      'third'
    ])
  })

  it('excludes the current source and candidates with no taxonomy overlap', () => {
    const current = scenario('current', 'source-a', ['risk-a'], ['concept-a'])
    const sameSource = scenario(
      'same-source',
      'source-a',
      ['risk-a'],
      ['concept-a']
    )
    const unrelated = scenario(
      'unrelated',
      'source-b',
      ['risk-b'],
      ['concept-b']
    )

    const discovery = discoverScenarios(current, [
      current,
      sameSource,
      unrelated
    ])

    expect(discovery.relatedScenarios).toEqual([])
  })

  it('weights specific concepts and rewards overlap across both taxonomies', () => {
    const current = scenario(
      'current',
      'source-a',
      ['risk-a'],
      ['concept-a', 'concept-b']
    )
    const riskOnly = scenario('risk-only', 'source-b', ['risk-a'], [])
    const conceptsOnly = scenario(
      'concepts-only',
      'source-c',
      [],
      ['concept-a', 'concept-b']
    )
    const both = scenario('both', 'source-d', ['risk-a'], ['concept-a'])

    const discovery = discoverScenarios(current, [
      riskOnly,
      conceptsOnly,
      current,
      both
    ])

    expect(
      discovery.relatedScenarios.map(({ scenario }) => scenario.slug)
    ).toEqual(['both', 'concepts-only', 'risk-only'])
    expect(discovery.relatedScenarios[0]).toMatchObject({
      sharedRiskFamilyIds: ['risk-a'],
      sharedConceptIds: ['concept-a']
    })
  })

  it('breaks equal-score ties by stable identity rather than snapshot order', () => {
    const current = scenario('current', 'source-a', ['risk-a'], ['concept-a'])
    const alpha = scenario('alpha', 'source-b', ['risk-a'], [])
    const beta = scenario('beta', 'source-c', ['risk-a'], [])

    const forward = discoverScenarios(current, [current, alpha, beta])
    const reverse = discoverScenarios(current, [beta, alpha, current])

    expect(
      forward.relatedScenarios.map(({ scenario }) => scenario.slug)
    ).toEqual(['alpha', 'beta'])
    expect(reverse.relatedScenarios).toEqual(forward.relatedScenarios)
  })

  it('reports shared ids once in the current scenario taxonomy order', () => {
    const current = scenario(
      'current',
      'source-a',
      ['risk-b', 'risk-a', 'risk-b'],
      ['concept-b', 'concept-a', 'concept-b']
    )
    const related = scenario(
      'related',
      'source-b',
      ['risk-a', 'risk-b'],
      ['concept-a', 'concept-b']
    )

    expect(discoverScenarios(current, [related]).relatedScenarios[0]).toEqual({
      scenario: related,
      sharedRiskFamilyIds: ['risk-b', 'risk-a'],
      sharedConceptIds: ['concept-b', 'concept-a']
    })
  })
})

function scenario(
  slug: string,
  sourceId: string,
  riskFamilyIds: readonly string[],
  conceptIds: readonly string[]
): TestScenario {
  return { id: slug, slug, sourceId, riskFamilyIds, conceptIds }
}
