import { describe, expect, it } from 'vitest'

import {
  GALLERY_HISTORY_STATE_KEY,
  mergeGalleryHistoryState,
  readGalleryHistoryState
} from './history-state'

const galleryState = {
  itemId: 'scenario-2',
  offsetX: -12.75,
  version: 1
} as const

describe('spatial gallery history state', () => {
  it('preserves Next history fields and other gallery entries', () => {
    const merged = mergeGalleryHistoryState(
      {
        __NA: true,
        [GALLERY_HISTORY_STATE_KEY]: {
          featured: {
            itemId: 'scenario-1',
            offsetX: 2,
            version: 1
          }
        }
      },
      'browse:all:release-desc',
      galleryState
    )

    expect(merged).toMatchObject({
      __NA: true,
      [GALLERY_HISTORY_STATE_KEY]: {
        featured: {
          itemId: 'scenario-1',
          offsetX: 2,
          version: 1
        },
        'browse:all:release-desc': galleryState
      }
    })
  })

  it('restores only finite positions for items in the current result set', () => {
    const merged = mergeGalleryHistoryState(null, 'featured', galleryState)

    expect(
      readGalleryHistoryState(
        merged,
        'featured',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual(galleryState)
    expect(
      readGalleryHistoryState(merged, 'featured', new Set(['scenario-1']))
    ).toBeNull()
  })

  it('never restores an offset across different gallery topologies', () => {
    const merged = mergeGalleryHistoryState(
      null,
      'browse:misalignment:release-desc',
      galleryState
    )

    expect(
      readGalleryHistoryState(
        merged,
        'browse:misalignment:release-asc',
        new Set(['scenario-2'])
      )
    ).toBeNull()
    expect(
      readGalleryHistoryState(
        merged,
        'browse:all:release-desc',
        new Set(['scenario-2'])
      )
    ).toBeNull()
  })

  it('rejects malformed or version-mismatched browser state', () => {
    expect(
      readGalleryHistoryState(
        {
          [GALLERY_HISTORY_STATE_KEY]: {
            featured: { ...galleryState, offsetX: Number.NaN }
          }
        },
        'featured',
        new Set(['scenario-2'])
      )
    ).toBeNull()
    expect(
      readGalleryHistoryState(
        {
          [GALLERY_HISTORY_STATE_KEY]: {
            featured: { ...galleryState, version: 2 }
          }
        },
        'featured',
        new Set(['scenario-2'])
      )
    ).toBeNull()
  })
})
