import { describe, expect, it } from 'vitest'

import { sortMediaSources } from './media-source-sort'

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
})
