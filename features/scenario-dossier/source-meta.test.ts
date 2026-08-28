import { describe, expect, it } from 'vitest'

import { hasDistinctEpisodeLabel } from './source-meta'

describe('hasDistinctEpisodeLabel', () => {
  it.each([
    ['Black Mirror', 'Nosedive', true],
    ['Ex Machina', 'Ex Machina', false],
    ['WALL·E', '  wall·e\n', false],
    ['Her', undefined, false]
  ] as const)(
    'compares normalized source and episode labels',
    (source, episode, expected) => {
      expect(hasDistinctEpisodeLabel(source, episode)).toBe(expected)
    }
  )
})
