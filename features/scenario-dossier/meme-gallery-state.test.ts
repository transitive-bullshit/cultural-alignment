import { describe, expect, it } from 'vitest'

import { getNextVisibleMemeCount } from './meme-gallery-state'

describe('meme gallery batching', () => {
  it.each([
    { totalCount: 0, expectedCounts: [0] },
    { totalCount: 4, expectedCounts: [4] },
    { totalCount: 10, expectedCounts: [10] },
    { totalCount: 11, expectedCounts: [10, 11] },
    { totalCount: 20, expectedCounts: [10, 20] },
    { totalCount: 21, expectedCounts: [10, 20, 21] }
  ])(
    'reveals a total of $totalCount in batches of ten',
    ({ totalCount, expectedCounts }) => {
      const counts = [getNextVisibleMemeCount(0, totalCount)]

      while (counts.at(-1)! < totalCount) {
        counts.push(getNextVisibleMemeCount(counts.at(-1)!, totalCount))
      }

      expect(counts).toEqual(expectedCounts)
    }
  )
})
