import { describe, expect, it } from 'vitest'

import { groupMediaSources, sortMediaSources } from './media-source-sort'

const sources = [
  { id: 'middle-b', title: 'Beta', releaseDate: '2005-02-03' },
  { id: 'newest', title: 'Delta', releaseDate: '2024-08-19' },
  { id: 'unknown', title: 'Echo', releaseDate: null },
  { id: 'oldest', title: 'charlie', releaseDate: '1997-11-07' },
  { id: 'middle-a', title: 'Alpha', releaseDate: '2005-02-03' }
] as const

describe('media source sorting', () => {
  it('sorts alphabetically by default without mutating the input', () => {
    const originalOrder = sources.map(({ id }) => id)

    expect(sortMediaSources(sources, 'default').map(({ id }) => id)).toEqual([
      'middle-a',
      'middle-b',
      'oldest',
      'newest',
      'unknown'
    ])
    expect(sources.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('sorts by age with unknown dates last and alphabetical ties', () => {
    expect(sortMediaSources(sources, 'newest').map(({ id }) => id)).toEqual([
      'newest',
      'middle-a',
      'middle-b',
      'oldest',
      'unknown'
    ])
    expect(sortMediaSources(sources, 'oldest').map(({ id }) => id)).toEqual([
      'oldest',
      'middle-a',
      'middle-b',
      'newest',
      'unknown'
    ])
  })

  it('groups the alphabetical list by first letter, digits and symbols first', () => {
    const titled = [
      ...sources,
      {
        id: 'digit',
        title: '2001: A Space Odyssey',
        releaseDate: '1968-04-02'
      },
      { id: 'accent', title: 'Éclair', releaseDate: '2010-01-01' },
      { id: 'quoted', title: '“Quoted”', releaseDate: null }
    ]
    const groups = groupMediaSources(
      sortMediaSources(titled, 'default'),
      'default'
    )

    expect(groups.map(({ label }) => label)).toEqual([
      '#',
      'A',
      'B',
      'C',
      'D',
      'E'
    ])
    expect(groups[0]!.items.map(({ id }) => id).toSorted()).toEqual([
      'digit',
      'quoted'
    ])
    expect(groups.find(({ label }) => label === 'E')!.items).toHaveLength(2)
    expect(groups.map(({ id }) => id)).toEqual([
      'sources-numbers',
      'sources-a',
      'sources-b',
      'sources-c',
      'sources-d',
      'sources-e'
    ])
  })

  it('keeps every source, in sorted order, across contiguous groups', () => {
    for (const sort of ['default', 'newest', 'oldest'] as const) {
      const sorted = sortMediaSources(sources, sort)
      const groups = groupMediaSources(sorted, sort)

      expect(groups.flatMap(({ items }) => items)).toEqual(sorted)
      expect(new Set(groups.map(({ id }) => id)).size).toBe(groups.length)
    }
  })

  it('groups date sorts by release decade with undated sources last', () => {
    const newest = groupMediaSources(
      sortMediaSources(sources, 'newest'),
      'newest'
    )
    const oldest = groupMediaSources(
      sortMediaSources(sources, 'oldest'),
      'oldest'
    )

    expect(newest.map(({ label }) => label)).toEqual([
      '2020s',
      '2000s',
      '1990s',
      'Undated'
    ])
    expect(oldest.map(({ label }) => label)).toEqual([
      '1990s',
      '2000s',
      '2020s',
      'Undated'
    ])
    expect(newest.at(-1)!.id).toBe('sources-undated')
  })
})
