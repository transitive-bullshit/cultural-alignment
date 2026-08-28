import { describe, expect, it } from 'vitest'

import { shouldShowEpisode } from './source-meta'

describe('shouldShowEpisode', () => {
  it.each([
    ['tv-show', 'Nosedive', true],
    ['tv-show', '', false],
    ['tv-show', '  \n', false],
    ['tv-show', undefined, false],
    ['movie', 'Ex Machina', false]
  ] as const)(
    'shows only non-empty TV episode labels',
    (sourceType, episode, expected) => {
      expect(shouldShowEpisode(sourceType, episode)).toBe(expected)
    }
  )
})
