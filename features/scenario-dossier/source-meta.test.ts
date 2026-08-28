import { describe, expect, it } from 'vitest'

import { hasDistinctEpisodeLabel } from './source-meta'

describe('hasDistinctEpisodeLabel', () => {
  it('keeps a distinct television episode', () => {
    expect(hasDistinctEpisodeLabel('Black Mirror', 'Nosedive')).toBe(true)
  })

  it('hides a movie-style episode that repeats the source title', () => {
    expect(hasDistinctEpisodeLabel('Ex Machina', 'Ex Machina')).toBe(false)
  })

  it('normalizes case, unicode, and whitespace before comparing', () => {
    expect(hasDistinctEpisodeLabel('WALL·E', '  wall·e\n')).toBe(false)
  })

  it('hides an absent episode', () => {
    expect(hasDistinctEpisodeLabel('Her', undefined)).toBe(false)
  })
})
