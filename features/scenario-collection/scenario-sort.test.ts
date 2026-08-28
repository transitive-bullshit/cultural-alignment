import { describe, expect, it } from 'vitest'

import {
  isScenarioSort,
  shouldEnableScenarioSorting,
  sortScenarioCollectionItems
} from './scenario-sort'

const listedItems = [
  { id: 'middle-a', releaseDate: '2005-02-03' },
  { id: 'newest', releaseDate: '2024-08-19' },
  { id: 'unknown', releaseDate: null },
  { id: 'oldest', releaseDate: '1997-11-07' },
  { id: 'middle-b', releaseDate: '2005-02-03' }
] as const

describe('scenario collection sorting', () => {
  it('preserves listed order for the default option', () => {
    expect(sortScenarioCollectionItems(listedItems, 'default')).toBe(
      listedItems
    )
  })

  it('sorts newest and oldest while keeping unknown dates last and ties stable', () => {
    expect(
      sortScenarioCollectionItems(listedItems, 'newest').map(({ id }) => id)
    ).toEqual(['newest', 'middle-a', 'middle-b', 'oldest', 'unknown'])
    expect(
      sortScenarioCollectionItems(listedItems, 'oldest').map(({ id }) => id)
    ).toEqual(['oldest', 'middle-a', 'middle-b', 'newest', 'unknown'])
  })

  it('enables the control only for continuous collections over three items', () => {
    expect(shouldEnableScenarioSorting('continuous', 4)).toBe(true)
    expect(shouldEnableScenarioSorting('continuous', 3)).toBe(false)
    expect(shouldEnableScenarioSorting('preview', 20)).toBe(false)
  })

  it('accepts only supported persisted options', () => {
    expect(isScenarioSort('default')).toBe(true)
    expect(isScenarioSort('newest')).toBe(true)
    expect(isScenarioSort('oldest')).toBe(true)
    expect(isScenarioSort('release-desc')).toBe(false)
    expect(isScenarioSort(null)).toBe(false)
  })
})
